"""Minute-exact UTC work slots; local calendars include DST and date overrides."""
from bisect import bisect_left
from array import array
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.schemas import Calendar

MINUTE = timedelta(minutes=1)


class PlanningError(ValueError):
    pass


class MinuteSlots(Sequence):
    """Compact UTC seconds; expose dates lazily to preserve engine semantics."""
    def __init__(self, values):
        self.values = array("q", values)

    def __len__(self):
        return len(self.values)

    def __getitem__(self, key):
        value = self.values[key]
        if isinstance(key, slice):
            return [datetime.fromtimestamp(t, timezone.utc) for t in value]
        return datetime.fromtimestamp(value, timezone.utc)


class WorkCalendar:
    def __init__(self, calendars: list[Calendar], zone: str, lower: datetime, upper: datetime):
        tz = ZoneInfo(zone)
        # Intersect local daily intervals, then materialize UTC minutes.
        # UTC iteration preserves both occurrences of repeated DST hours.
        timestamps = array("q")
        lower = lower.astimezone(timezone.utc)
        upper = upper.astimezone(timezone.utc)
        day = lower.astimezone(tz).date()
        last = upper.astimezone(tz).date()
        while day <= last:
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
                    timestamps.extend(range(int(cursor.timestamp()), int(stop.timestamp()), 60))
                    continue
                while cursor < min(end, upper):
                    local = cursor.astimezone(tz)
                    if a <= local.time().replace(tzinfo=None) < b:
                        timestamps.append(int(cursor.timestamp()))
                    cursor += MINUTE
            day += timedelta(days=1)
        # Validated daily shifts are disjoint. DST intervals can overlap in UTC.
        if any(a >= b for a, b in zip(timestamps, timestamps[1:])):
            timestamps = array("q", sorted(set(timestamps)))
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
