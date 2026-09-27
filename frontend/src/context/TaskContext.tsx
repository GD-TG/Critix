import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Dependency, Result, Task } from "@/types";

interface TaskContextValue {
  // Task drawer
  task: Task | null;
  setTask: (t: Task | null) => void;
  newTaskSkill: string;
  setNewTaskSkill: (v: string) => void;
  taskInlinePredId: string;
  setTaskInlinePredId: (v: string) => void;
  taskInlinePredKind: Dependency["kind"];
  setTaskInlinePredKind: (v: Dependency["kind"]) => void;
  taskInlinePredLagHours: number;
  setTaskInlinePredLagHours: (v: number) => void;
  taskInlinePredLagMode: Dependency["lag_mode"];
  setTaskInlinePredLagMode: (v: Dependency["lag_mode"]) => void;

  // Dependency creation modal
  depModal: boolean;
  setDepModal: (v: boolean) => void;
  newDepPred: string;
  setNewDepPred: (v: string) => void;
  newDepSucc: string;
  setNewDepSucc: (v: string) => void;
  newDepKind: Dependency["kind"];
  setNewDepKind: (v: Dependency["kind"]) => void;
  newDepLagHours: number;
  setNewDepLagHours: (v: number) => void;
  newDepLagMode: Dependency["lag_mode"];
  setNewDepLagMode: (v: Dependency["lag_mode"]) => void;

  // Dependency edit modal
  editingDepIndex: number | null;
  setEditingDepIndex: (v: number | null) => void;
  editDepKind: Dependency["kind"];
  setEditDepKind: (v: Dependency["kind"]) => void;
  editDepLagHours: number;
  setEditDepLagHours: (v: number) => void;
  editDepLagMode: Dependency["lag_mode"];
  setEditDepLagMode: (v: Dependency["lag_mode"]) => void;

  // Scenario simulation
  simTaskChoice: string;
  setSimTaskChoice: (v: string) => void;
  simDelayDays: number;
  setSimDelayDays: (v: number) => void;
  simResult: Result | null;
  setSimResult: (v: Result | null) => void;
  simError: string;
  setSimError: (v: string) => void;
  simBusy: boolean;
  setSimBusy: (v: boolean) => void;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [task, setTask] = useState<Task | null>(null);
  const [newTaskSkill, setNewTaskSkill] = useState("");

  const [taskInlinePredId, setTaskInlinePredId] = useState("");
  const [taskInlinePredKind, setTaskInlinePredKind] = useState<Dependency["kind"]>("FS");
  const [taskInlinePredLagHours, setTaskInlinePredLagHours] = useState<number>(0);
  const [taskInlinePredLagMode, setTaskInlinePredLagMode] = useState<Dependency["lag_mode"]>("working");

  const [depModal, setDepModal] = useState(false);
  const [newDepPred, setNewDepPred] = useState("");
  const [newDepSucc, setNewDepSucc] = useState("");
  const [newDepKind, setNewDepKind] = useState<Dependency["kind"]>("FS");
  const [newDepLagHours, setNewDepLagHours] = useState<number>(0);
  const [newDepLagMode, setNewDepLagMode] = useState<Dependency["lag_mode"]>("working");

  const [editingDepIndex, setEditingDepIndex] = useState<number | null>(null);
  const [editDepKind, setEditDepKind] = useState<Dependency["kind"]>("FS");
  const [editDepLagHours, setEditDepLagHours] = useState<number>(0);
  const [editDepLagMode, setEditDepLagMode] = useState<Dependency["lag_mode"]>("working");

  const [simTaskChoice, setSimTaskChoice] = useState<string>("");
  const [simDelayDays, setSimDelayDays] = useState<number>(2);
  const [simResult, setSimResult] = useState<Result | null>(null);
  const [simError, setSimError] = useState("");
  const [simBusy, setSimBusy] = useState(false);

  const value: TaskContextValue = {
    task, setTask, newTaskSkill, setNewTaskSkill,
    taskInlinePredId, setTaskInlinePredId,
    taskInlinePredKind, setTaskInlinePredKind,
    taskInlinePredLagHours, setTaskInlinePredLagHours,
    taskInlinePredLagMode, setTaskInlinePredLagMode,
    depModal, setDepModal,
    newDepPred, setNewDepPred,
    newDepSucc, setNewDepSucc,
    newDepKind, setNewDepKind,
    newDepLagHours, setNewDepLagHours,
    newDepLagMode, setNewDepLagMode,
    editingDepIndex, setEditingDepIndex,
    editDepKind, setEditDepKind,
    editDepLagHours, setEditDepLagHours,
    editDepLagMode, setEditDepLagMode,
    simTaskChoice, setSimTaskChoice,
    simDelayDays, setSimDelayDays,
    simResult, setSimResult,
    simError, setSimError,
    simBusy, setSimBusy,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskState() {
  const context = useContext(TaskContext);
  if (!context) throw new Error("useTaskState должен использоваться внутри TaskProvider");
  return context;
}
