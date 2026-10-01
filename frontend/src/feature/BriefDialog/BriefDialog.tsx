import { Button, CopyButton, Modal, Paper, Stack, Tabs, Text } from "@mantine/core";
import { Check, Copy, MessageSquare, Send, Users } from "lucide-react";
import { useBriefDialog } from "./useBriefDialog";

export function BriefDialog() {
  const { opened, closeDialog, activeTab, setActiveTab, texts } = useBriefDialog();

  return (
    <Modal
      opened={opened}
      onClose={closeDialog}
      title="Сообщить об изменениях"
      size="lg"
      centered
    >
      <Tabs value={activeTab} onChange={(val) => setActiveTab(val || "client")}>
        <Tabs.List>
          <Tabs.Tab value="client" leftSection={<Send size={15} />}>
            Письмо заказчику
          </Tabs.Tab>
          <Tabs.Tab value="short" leftSection={<MessageSquare size={15} />}>
            Коротко (TG/Slack)
          </Tabs.Tab>
          <Tabs.Tab value="team" leftSection={<Users size={15} />}>
            Команде
          </Tabs.Tab>
        </Tabs.List>

        <Stack mt="md" gap="md">
          {activeTab === "client" && (
            <>
              <Text size="xs" c="dimmed">
                Официальное структурированное письмо с анализом рисков и финансовыми последствиями:
              </Text>
              <Paper withBorder p="sm" bg="var(--bg)" radius="md">
                <Text size="xs" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                  {texts.client}
                </Text>
              </Paper>
              <CopyButton value={texts.client}>
                {({ copied, copy }) => (
                  <Button
                    color={copied ? "teal" : "red"}
                    onClick={copy}
                    leftSection={copied ? <Check size={16} /> : <Copy size={16} />}
                  >
                    {copied ? "Скопировано в буфер!" : "Скопировать письмо"}
                  </Button>
                )}
              </CopyButton>
            </>
          )}

          {activeTab === "short" && (
            <>
              <Text size="xs" c="dimmed">
                Компактная сводка для чатов и оперативных планёрок:
              </Text>
              <Paper withBorder p="sm" bg="var(--bg)" radius="md">
                <Text size="xs" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                  {texts.short}
                </Text>
              </Paper>
              <CopyButton value={texts.short}>
                {({ copied, copy }) => (
                  <Button
                    color={copied ? "teal" : "red"}
                    onClick={copy}
                    leftSection={copied ? <Check size={16} /> : <Copy size={16} />}
                  >
                    {copied ? "Скопировано в буфер!" : "Скопировать сводку"}
                  </Button>
                )}
              </CopyButton>
            </>
          )}

          {activeTab === "team" && (
            <>
              <Text size="xs" c="dimmed">
                Персональные уведомления для исполнителей с перечнем сместившихся задач:
              </Text>
              <Paper withBorder p="sm" bg="var(--bg)" radius="md">
                <Text size="xs" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                  {texts.team}
                </Text>
              </Paper>
              <CopyButton value={texts.team}>
                {({ copied, copy }) => (
                  <Button
                    color={copied ? "teal" : "red"}
                    onClick={copy}
                    leftSection={copied ? <Check size={16} /> : <Copy size={16} />}
                  >
                    {copied ? "Скопировано в буфер!" : "Скопировать сообщение для команды"}
                  </Button>
                )}
              </CopyButton>
            </>
          )}
        </Stack>
      </Tabs>
    </Modal>
  );
}
