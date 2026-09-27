import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useTeam } from "@/context/TeamContext";
import {
  calculateSkillMatch,
  formatMinutes,
  formatShortDate,
  getAvatarClass,
  getInitials,
  getZone,
  skillLevelLabels,
} from "@/shared";
import { defaultCalendar, type Person, type Skill } from "@/types";

export function useTeamView() {
  const { draft, saved, rows, overloadedAssigneeIds, change } = useProjects();
  const { activeView, setActiveView, showNotification } = useUi();
  const {
    selectedAssigneeId,
    setSelectedAssigneeId,
    teamMemberSearch,
    setTeamMemberSearch,
    inlineNewSkillName,
    setInlineNewSkillName,
    inlineNewSkillLevel,
    setInlineNewSkillLevel,
  } = useTeam();

  const zone = getZone(draft, saved);
  const shortDate = (iso: string) => formatShortDate(iso, zone);

  const addPerson = () => {
    if (!draft) return;
    const newId = crypto.randomUUID();
    const newPerson: Person = {
      id: newId,
      name: `Сотрудник ${draft.assignees.length + 1}`,
      role: "Разработчик",
      skills: [],
      calendar: defaultCalendar(),
    };
    change({
      ...draft,
      assignees: [...draft.assignees, newPerson],
    });
    setSelectedAssigneeId(newId);
    showNotification(`Сотрудник «${newPerson.name}» добавлен`);
  };

  const createFirstPerson = () => {
    if (!draft) return;
    const newId = crypto.randomUUID();
    change({
      ...draft,
      assignees: [
        {
          id: newId,
          name: "Алексей Смирнов",
          role: "Project Manager",
          skills: [{ name: "PM", level: "expert" }],
          calendar: defaultCalendar(),
        },
      ],
    });
    setSelectedAssigneeId(newId);
  };

  const removePerson = (person: Person) => {
    if (!draft) return;
    const newAssignees = draft.assignees.filter((a) => a.id !== person.id);
    change({
      ...draft,
      assignees: newAssignees,
      tasks: draft.tasks.map((t) =>
        t.assignee_id === person.id ? { ...t, assignee_id: null } : t
      ),
    });
    setSelectedAssigneeId(newAssignees[0]?.id || null);
    showNotification(`Сотрудник «${person.name}» удален`);
  };

  const updatePerson = (personId: string, patch: Partial<Person>) => {
    if (!draft) return;
    change({
      ...draft,
      assignees: draft.assignees.map((a) =>
        a.id === personId ? { ...a, ...patch } : a
      ),
    });
  };

  const removeSkill = (personId: string, skillIndex: number) => {
    if (!draft) return;
    change({
      ...draft,
      assignees: draft.assignees.map((a) =>
        a.id === personId
          ? { ...a, skills: a.skills?.filter((_, i) => i !== skillIndex) || [] }
          : a
      ),
    });
  };

  const addSkill = (personId: string) => {
    if (!draft || !inlineNewSkillName.trim()) return;
    change({
      ...draft,
      assignees: draft.assignees.map((a) =>
        a.id === personId
          ? {
              ...a,
              skills: [
                ...(a.skills || []),
                { name: inlineNewSkillName.trim(), level: inlineNewSkillLevel },
              ],
            }
          : a
      ),
    });
    setInlineNewSkillName("");
  };

  const updateCalendar = (personId: string, calendar: Person["calendar"]) => {
    if (!draft) return;
    change({
      ...draft,
      assignees: draft.assignees.map((a) =>
        a.id === personId ? { ...a, calendar } : a
      ),
    });
  };

  return {
    draft,
    rows,
    overloadedAssigneeIds,
    activeView,
    selectedAssigneeId,
    setSelectedAssigneeId,
    teamMemberSearch,
    setTeamMemberSearch,
    inlineNewSkillName,
    setInlineNewSkillName,
    inlineNewSkillLevel,
    setInlineNewSkillLevel,
    setActiveView,
    addPerson,
    createFirstPerson,
    removePerson,
    updatePerson,
    removeSkill,
    addSkill,
    updateCalendar,
    getAvatarClass,
    getInitials,
    calculateSkillMatch,
    skillLevelLabels,
    formatMinutes,
    shortDate,
    typeSkillLevel: (v: string | null) => (v as Skill["level"]) || "expert",
  };
}