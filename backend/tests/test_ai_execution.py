import asyncio
from threading import BoundedSemaphore, Event, get_ident
from uuid import uuid4

import pytest
from fastapi import HTTPException
from app import main


@pytest.mark.parametrize("use_chat", [False, True])
def test_ai_preparation_runs_off_loop_and_releases_resources_before_provider(monkeypatch, use_chat):
    loop_thread = get_ident()
    started, release = Event(), Event()
    state = {"closed": False}
    data = object()
    slots = BoundedSemaphore(2)
    monkeypatch.setattr(main, "calculation_slots", slots)

    class Session:
        def __enter__(self):
            assert get_ident() != loop_thread
            state["thread"] = get_ident()
            return self

        def __exit__(self, *args):
            assert get_ident() == state["thread"]
            state["closed"] = True

    def read(db, project_id):
        assert get_ident() == state["thread"]
        return 1, data

    def analyze(project):
        assert state["closed"]
        assert get_ident() != loop_thread
        started.set()
        assert release.wait(3), "event loop did not remain responsive"
        return {"finish": "test"}

    async def provider(*args):
        assert get_ident() == loop_thread
        assert slots.acquire(blocking=False)
        assert slots.acquire(blocking=False), "slot held during provider wait"
        slots.release()
        slots.release()
        return {"available": True}

    monkeypatch.setattr(main, "SessionLocal", Session)
    monkeypatch.setattr(main.service, "read", read)
    monkeypatch.setattr(main, "analyze", analyze)
    monkeypatch.setattr(main, "explain", provider)
    monkeypatch.setattr(main, "chat", provider)

    async def run():
        request = (main.chat_copilot(uuid4(), main.ChatRequest(messages=[main.ChatMessage(role="user", content="test")]))
                   if use_chat else main.ai(uuid4()))
        task = asyncio.create_task(request)
        try:
            assert await asyncio.to_thread(started.wait, 3)
            assert not task.done()
        finally:
            release.set()
        assert (await task)["available"]

    asyncio.run(run())


def test_context_failure_releases_slot_and_closes_session(monkeypatch):
    slots = BoundedSemaphore(1)
    closed = []
    class Session:
        def __enter__(self): return self
        def __exit__(self, *args): closed.append(True)
    def fail(*args): raise HTTPException(404, "missing")
    monkeypatch.setattr(main, "calculation_slots", slots)
    monkeypatch.setattr(main, "SessionLocal", Session)
    monkeypatch.setattr(main.service, "read", fail)
    with pytest.raises(HTTPException): main.prepare_ai_context(uuid4())
    assert closed == [True]
    assert slots.acquire(blocking=False)
    slots.release()
