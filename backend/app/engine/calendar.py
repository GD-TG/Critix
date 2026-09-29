"""Minute-exact UTC work slots; local calendars include DST and date overrides."""
from bisect import bisect_left
from array import array
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from time import monotonic
from zoneinfo import ZoneInfo

from app.schemas import Calendar

MINUTE = timedelta(minutes=1)
MAX_HORIZON_DAYS = 1096
MAX_CALENDAR_MINUTES = 4_000_000
MAX_WORK_MINUTES = 4_000_000
MAX_RESOURCE_SEGMENTS = 20_000
MAX_CALCULATION_SECONDS = 10


class PlanningError(ValueError):
    pass


class ResourceLimitError(PlanningError):
    """A rejected calculation, never a partially valid schedule."""


class CalculationBudget:
    def __init__(self):
        self.deadline = monotonic() + MAX_CALCULATION_SECONDS
        self.work_minutes = 0

    def check(self):
        if monotonic() > self.deadline:
            raise ResourceLimitError("Превышено время расчёта. Сократите план или число вариантов календаря")

    def consume_work(self, minutes):
        self.check()
        if self.work_minutes + minutes > MAX_WORK_MINUTES:
            raise ResourceLimitError("Превышен бюджет обработки рабочих минут. Сократите объём расчёта")
        self.work_minutes += minutes


class MinuteSlots(Sequence):
    """Compact UTC seconds; expose dates lazily to preserve engine semantics."""
    def __init__(self, values):
        self.values = values if isinstance(values, array) and values.typecode == "q" else array("q", values)

    def __len__(self):
        return len(self.values)

    def __getitem__(self, key):
        value = self.values[key]
        if isinstance(key, slice):
            return [datetime.fromtimestamp(t, timezone.utc) for t in value]
        return datetime.fromtimestamp(value, timezone.utc)


class WorkCalendar:
    def __init__(self, calendars: list[Calendar], zone: str, lower: datetime, upper: datetime,
                 *, max_minutes=MAX_CALENDAR_MINUTES, budget=None):
        budget = budget or CalculationBudget()
        if upper <= lower or (upper - lower).total_seconds() > MAX_HORIZON_DAYS * 86400:
            raise ResourceLimitError(f"Горизонт расчёта не должен превышать {MAX_HORIZON_DAYS} дней")
        tz = ZoneInfo(zone)
        # Intersect local daily intervals, then materialize UTC minutes.
        # UTC iteration preserves both occurrences of repeated DST hours.
        timestamps = array("q")
        lower = lower.astimezone(timezone.utc)
        upper = upper.astimezone(timezone.utc)
        day = lower.astimezone(tz).date()
        last = upper.astimezone(tz).date()
        while day <= last:
            budget.check()
            day_values = array("q")
            shifts = [cal.exceptions.get(day, cal.week.get(day.weekday(), [])) for cal in calendars]
            intervals = [(s.start, s.end) for s in shifts[0]]
            for group in shifts[1:]:
                intervals = [(max(a, s.start), min(b, s.end)) for a, b in intervals for s in group
                             if max(a, s.start) < min(b, s.end)]
            for a, b in sorted(intervals):
                begin = datetime.combine(day, a, tzinfo=tz).astimezone(timezone.utc)
                end = datetime.combine(day, b, tzinfo=tz).replace(fold=1).astimezone(timezone.utc)
                cursor = max(begin, lower)
                stop = min(end, upper)
                # Most days have no UTC-offset transition: no per-minute date objects.
                if begin.astimezone(tz).utcoffset() == (end - MINUTE).astimezone(tz).utcoffset():
                    day_values.extend(range(int(cursor.timestamp()), int(stop.timestamp()), 60))
                    continue
                while cursor < min(end, upper):
                    local = cursor.astimezone(tz)
                    if a <= local.time().replace(tzinfo=None) < b:
                        day_values.append(int(cursor.timestamp()))
                    cursor += MINUTE
            # Normalize only one day: sorting the entire multi-year grid would
            # temporarily turn a compact array into millions of Python objects.
            if any(a >= b for a, b in zip(day_values, day_values[1:])):
                day_values = array("q", sorted(set(day_values)))
            if len(timestamps) + len(day_values) > max_minutes:
                raise ResourceLimitError("Превышен общий бюджет календарей. Сократите горизонт или число различных календарей")
            if timestamps and day_values and timestamps[-1] >= day_values[0]:
                raise PlanningError("Переход часового пояса создаёт пересекающиеся календарные дни")
            timestamps.extend(day_values)
            if day == last:
                break
            day += timedelta(days=1)
        self.slots = MinuteSlots(timestamps)
        if not self.slots:
            raise PlanningError("Календари не имеют общего рабочего времени в горизонте расчёта")

    def index(self, when: datetime) -> int:
        return bisect_left(self.slots.values, when.timestamp())

    def start(self, index: int) -> datetime:
        if not 0 <= index < len(self.slots):
            raise PlanningError("План вышел за горизонт расчёта")
        return self.slots[index]

    def finish(self, index: int, duration: int) -> datetime:
        if duration == 0:
            return self.start(index)
        return self.start(index + duration - 1) + MINUTE

    def shift(self, when: datetime, minutes: int) -> datetime:
        if minutes == 0:
            return when
        index = self.index(when)
        if minutes > 0:
            return self.finish(index, minutes)
        return self.start(index + minutes)
