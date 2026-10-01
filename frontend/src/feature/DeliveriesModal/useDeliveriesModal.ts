import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import type {
  DeliveryCase,
  DeliveryCaseAction,
  DeliveryCasesResponse,
  DeliveryEventPreviewResponse,
  Result,
} from "@/types";

export function useDeliveriesModal() {
  const {
    draft,
    saved,
    deliveriesModalOpened,
    setDeliveriesModalOpened,
    accept,
    run,
    showNotification,
  } = useApp();

  const [loadingCases, setLoadingCases] = useState(false);
  const [deliveryCases, setDeliveryCases] = useState<DeliveryCase[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<DeliveryCaseAction | null>(null);

  const [expectedDate, setExpectedDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<DeliveryEventPreviewResponse | null>(null);

  const [selectedDecision, setSelectedDecision] = useState<"accept_change" | "defer_optional">("accept_change");
  const [decisionOwner, setDecisionOwner] = useState<string>("Владелец продукта");
  const [isApplying, setIsApplying] = useState(false);

  // Fetch delivery cases when modal opens
  const fetchCases = useCallback(async () => {
    if (!saved?.id) return;
    setLoadingCases(true);
    try {
      const res = await api<DeliveryCasesResponse>(`/projects/${saved.id}/delivery-cases`);
      if (res && res.deliveries) {
        setDeliveryCases(res.deliveries);
      }
    } catch (err: any) {
      showNotification(`Ошибка загрузки поставок: ${err?.message || err}`);
    } finally {
      setLoadingCases(false);
    }
  }, [saved?.id, showNotification]);

  useEffect(() => {
    if (deliveriesModalOpened && saved?.id) {
      fetchCases();
      setSelectedDeliveryId(null);
      setSelectedAction(null);
      setPreviewData(null);
      setReason("");
      setExpectedDate("");
    }
  }, [deliveriesModalOpened, saved?.id, fetchCases]);

  const selectDeliveryAndAction = (deliveryId: string, action: DeliveryCaseAction) => {
    setSelectedDeliveryId(deliveryId);
    setSelectedAction(action);
    setPreviewData(null);
    setReason("");

    const delivery = deliveryCases.find((d) => d.delivery_id === deliveryId);
    if (action.requires_date && delivery) {
      // Default to 1 day after current expected or promised
      const base = delivery.expected_at || delivery.promised_at;
      if (base) {
        const d = new Date(base);
        d.setDate(d.getDate() + 1);
        setExpectedDate(d.toISOString().slice(0, 16));
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        setExpectedDate(d.toISOString().slice(0, 16));
      }
    } else {
      setExpectedDate("");
    }
  };

  const handleComputePreview = async () => {
    if (!saved?.id || !selectedDeliveryId || !selectedAction) return;
    if (!reason.trim()) {
      showNotification("Укажите причину события");
      return;
    }

    setLoadingPreview(true);
    try {
      const body: any = {
        version: saved.version,
        delivery_id: selectedDeliveryId,
        kind: selectedAction.kind,
        reason: reason.trim(),
      };
      if (selectedAction.requires_date && expectedDate) {
        body.expected_at = new Date(expectedDate).toISOString();
      }

      const res = await api<DeliveryEventPreviewResponse>(
        `/projects/${saved.id}/delivery-events/preview`,
        "POST",
        body
      );
      setPreviewData(res);
      if (res.variants && res.variants.length > 0) {
        setSelectedDecision(res.variants[0].decision);
      }
    } catch (err: any) {
      showNotification(`Ошибка расчёта последствий: ${err?.message || err}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApplyDecision = async () => {
    if (!saved?.id || !selectedDeliveryId || !selectedAction || !previewData) return;
    if (!decisionOwner.trim()) {
      showNotification("Укажите ответственного за принятие решения");
      return;
    }

    setIsApplying(true);
    try {
      const body: any = {
        version: saved.version,
        delivery_id: selectedDeliveryId,
        kind: selectedAction.kind,
        reason: reason.trim(),
        decision: selectedDecision,
        decision_owner: decisionOwner.trim(),
      };
      if (selectedAction.requires_date && expectedDate) {
        body.expected_at = new Date(expectedDate).toISOString();
      }

      const updated = await run(() =>
        api<Result>(`/projects/${saved.id}/delivery-events`, "POST", body)
      );
      if (updated) {
        accept(updated, true);
        showNotification("Решение по поставке успешно применено и зафиксировано в истории!");
        setDeliveriesModalOpened(false);
      }
    } catch (err: any) {
      showNotification(`Ошибка применения решения: ${err?.message || err}`);
    } finally {
      setIsApplying(false);
    }
  };

  const selectedDelivery = deliveryCases.find((d) => d.delivery_id === selectedDeliveryId);

  return {
    opened: deliveriesModalOpened,
    closeModal: () => setDeliveriesModalOpened(false),
    loadingCases,
    deliveryCases,
    selectedDelivery,
    selectedAction,
    expectedDate,
    setExpectedDate,
    reason,
    setReason,
    loadingPreview,
    previewData,
    selectedDecision,
    setSelectedDecision,
    decisionOwner,
    setDecisionOwner,
    isApplying,
    selectDeliveryAndAction,
    resetAction: () => {
      setSelectedAction(null);
      setPreviewData(null);
    },
    handleComputePreview,
    handleApplyDecision,
    draft,
    saved,
  };
}
