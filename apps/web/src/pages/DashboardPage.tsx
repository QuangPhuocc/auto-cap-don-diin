import { CircleCheck, CircleX, Clock3, FileText, RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, CardContent, Select } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { money } from "../lib/utils";

type Stats = { totalPolicies: number; issuedPolicies: number; failedPolicies: number; pendingJobs: number; totalRevenue: number; activeUsers?: number };

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>();
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<"month" | "year">("month");

  useEffect(() => {
    if (user) {
      setFilterType(user.username === "0869200835" ? "year" : "month");
    }
  }, [user]);

  const load = (type: "month" | "year") =>
    api<Stats>(`/dashboard/stats?filterType=${type}`)
      .then(setStats)
      .catch((e) => setError(e.message));

  useEffect(() => {
    if (user) {
      void load(filterType);
    }
  }, [filterType, user]);

  const cards = [
    { label: "Tổng đơn", value: stats?.totalPolicies ?? "—", icon: FileText, color: "text-blue-600 bg-blue-50" },
    { label: "Đã phát hành", value: stats?.issuedPolicies ?? "—", icon: CircleCheck, color: "text-emerald-600 bg-emerald-50" },
    { label: "Đang xử lý", value: stats?.pendingJobs ?? "—", icon: Clock3, color: "text-amber-600 bg-amber-50" },
    { label: "Thất bại", value: stats?.failedPolicies ?? "—", icon: CircleX, color: "text-red-600 bg-red-50" },
    ...(user?.role === "ADMIN" ? [{ label: "CTV hoạt động", value: stats?.activeUsers ?? "—", icon: Users, color: "text-violet-600 bg-violet-50" }] : [])
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Xin chào, {user?.fullName}</h2>
          <p className="text-muted-foreground">Tổng quan hoạt động phát hành</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value as "month" | "year")} className="w-36">
            <option value="month">Tháng này</option>
            <option value="year">Cả năm</option>
          </Select>
          <Button variant="outline" size="icon" onClick={() => load(filterType)}>
            <RefreshCw size={18} />
          </Button>
        </div>
      </div>
      
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${card.color}`}>
                <card.icon size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="text-sm text-muted-foreground">{card.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardContent className="flex flex-col items-start justify-between gap-4 pt-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Doanh thu</p>
            <p className="text-3xl font-bold text-orange-600">{money(stats?.totalRevenue || 0)}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/policies/new">Tạo đơn</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
