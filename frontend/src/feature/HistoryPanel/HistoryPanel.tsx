import { ScrollArea, Text } from "@mantine/core";
import { useHistoryPanel } from "./useHistoryPanel";

export function HistoryPanel() {
  const { history, historyError, date } = useHistoryPanel();

  return (
    <article className="panel activity-panel" id="tasks">
      <div className="panel-header">
        <div>
          <h2>История сохранений</h2>
          <p>Последние 20 версий проекта</p>
        </div>
      </div>
      {historyError && <Text c="red" size="sm" p="sm">{historyError}</Text>}
      {!history.length && !historyError && <Text c="dimmed" size="sm" p="md">Нет загруженных версий</Text>}
      <ScrollArea h={200}>
        {history.map((item) => (
          <div className="activity-row" key={item.version}>
            <div>
              <strong>Версия {item.version}</strong>
              <span> · {item.task_count} задач</span>
              <small>{date(item.created_at)} · прогноз: {date(item.finish)}</small>
            </div>
          </div>
        ))}
      </ScrollArea>
    </article>
  );
}
