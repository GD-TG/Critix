import { useEffect, useRef } from "react";
import { createRequestGate } from "./requestState";

export function useRequestGate(...dependencies: unknown[]) {
  const ref = useRef<ReturnType<typeof createRequestGate> | null>(null);
  if (!ref.current) ref.current = createRequestGate();
  const gate = ref.current;
  gate.update(dependencies);
  useEffect(() => () => gate.invalidate(), [gate]);
  return gate;
}
