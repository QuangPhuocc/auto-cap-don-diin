import { X, Download, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { download } from "../lib/api";
import type { Policy } from "../lib/types";
import { dateTime, money } from "../lib/utils";
import { Badge, Button } from "./ui";

const statusStyle: Record<string, string> = {
  ISSUED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  QUEUED: "bg-amber-100 text-amber-700",
};
const statusText: Record<string, string> = {
  ISSUED: "Đã phát hành",
  FAILED: "Thất bại",
  PROCESSING: "Đang lấy link GCN...",
  QUEUED: "Đang xếp hàng...",
};

function cleanGCN(gcn: string | null | undefined): string {
  if (!gcn) return "—";
  const parts = gcn.split("_");
  if (parts.length > 1) return parts[parts.length - 1].replace(/\.pdf$/i, "");
  return gcn.replace(/\.pdf$/i, "");
}

function cleanPlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

interface PolicyDetailModalProps {
  policy: Policy;
  onClose: () => void;
}

export function PolicyDetailModal({ policy, onClose }: PolicyDetailModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (policy.pdfUrl) {
      navigator.clipboard.writeText(policy.pdfUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2.5 border-b last:border-0">
      <span className="text-xs text-stone-500 font-medium w-36 shrink-0">{label}</span>
      <span className="text-sm text-stone-800 font-medium break-all">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-stone-50">
          <div>
            <div className="font-bold text-base text-stone-900">{policy.customerName}</div>
            <div className="font-mono text-sm text-orange-600 font-semibold">{policy.plateNumber}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors text-stone-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-2">
          <Row label="Trạng thái" value={
            <Badge className={`flex items-center gap-1 w-fit ${statusStyle[policy.status]}`}>
              {(policy.status === "PROCESSING" || policy.status === "QUEUED") && (
                <RefreshCw size={11} className="animate-spin" />
              )}
              {statusText[policy.status]}
            </Badge>
          } />
          <Row label="Số GCN" value={
            <span className="font-mono text-xs">{cleanGCN(policy.certificateNumber)}</span>
          } />
          <Row label="Phí bảo hiểm" value={policy.premium ? money(policy.premium) : "—"} />
          <Row label="Ngày tạo đơn" value={dateTime(policy.createdAt)} />
          {policy.issuedAt && (
            <Row label="Ngày phát hành" value={dateTime(policy.issuedAt)} />
          )}
          {policy.agent && <Row label="Đại lý" value={policy.agent} />}
          {policy.user && (
            <Row label="Người cấp" value={policy.user.fullName} />
          )}
          {policy.status === "FAILED" && policy.error && (
            <div className="mt-2 mb-1 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
              {policy.error}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(policy.pdfPath || policy.pdfUrl) && (
          <div className="flex items-center gap-2 px-5 py-4 border-t bg-stone-50">
            {policy.pdfPath && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => download(`/policies/${policy.id}/pdf`, `${cleanPlate(policy.plateNumber)}.pdf`)}
                className="flex items-center gap-1.5"
              >
                <Download size={14} />
                Tải PDF
              </Button>
            )}
            {policy.pdfUrl && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5"
                >
                  {copied ? (
                    <><Check size={14} className="text-emerald-600" />Đã chép</>
                  ) : (
                    <><Copy size={14} />Copy link</>
                  )}
                </Button>
                <a
                  href={policy.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-stone-400 hover:text-orange-500 flex items-center gap-1 transition-colors"
                >
                  <ExternalLink size={12} />
                  Mở PDF
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
