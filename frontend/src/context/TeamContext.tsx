import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { defaultCalendar, safeRandomUuid, type Person, type Skill } from "@/types";

interface TeamContextValue {
  selectedAssigneeId: string | null;
  setSelectedAssigneeId: (id: string | null) => void;
  teamMemberSearch: string;
  setTeamMemberSearch: (v: string) => void;
  inlineNewSkillName: string;
  setInlineNewSkillName: (v: string) => void;
  inlineNewSkillLevel: Skill["level"];
  setInlineNewSkillLevel: (v: Skill["level"]) => void;
  newSkillName: string;
  setNewSkillName: (v: string) => void;
  newSkillLevel: Skill["level"];
  setNewSkillLevel: (v: Skill["level"]) => void;
  skillTargetAssigneeId: string | null;
  setSkillTargetAssigneeId: (v: string | null) => void;
  addPerson: () => void;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { draft, change } = useProjects();
  const { setActiveView } = useUi();

  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [teamMemberSearch, setTeamMemberSearch] = useState<string>("");
  const [inlineNewSkillName, setInlineNewSkillName] = useState("");
  const [inlineNewSkillLevel, setInlineNewSkillLevel] = useState<Skill["level"]>("expert");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState<Skill["level"]>("expert");
  const [skillTargetAssigneeId, setSkillTargetAssigneeId] = useState<string | null>(null);

  const addPerson = useCallback(() => {
    if (!draft) return;
    const newId = safeRandomUuid();
    const newPerson: Person = {
      id: newId,
      name: `Сотрудник ${draft.assignees.length + 1}`,
      role: "Разработчик",
      skills: [],
      calendar: defaultCalendar(),
    };
    change({ ...draft, assignees: [...draft.assignees, newPerson] });
    setSelectedAssigneeId(newId);
    setActiveView("team");
  }, [draft, change, setActiveView]);

  const value: TeamContextValue = {
    selectedAssigneeId, setSelectedAssigneeId,
    teamMemberSearch, setTeamMemberSearch,
    inlineNewSkillName, setInlineNewSkillName,
    inlineNewSkillLevel, setInlineNewSkillLevel,
    newSkillName, setNewSkillName,
    newSkillLevel, setNewSkillLevel,
    skillTargetAssigneeId, setSkillTargetAssigneeId,
    addPerson,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) throw new Error("useTeam должен использоваться внутри TeamProvider");
  return context;
}
