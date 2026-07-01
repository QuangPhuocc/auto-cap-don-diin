import { Plus, UserRoundCog, ArrowLeft, Download, RefreshCw, Copy, Check, FileSpreadsheet, Edit3 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { api, download } from "../lib/api";
import type { User, Policy } from "../lib/types";
import { dateTime, money } from "../lib/utils";

export function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [show, setShow] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const load = () => api<{ items: User[] }>("/users").then((r) => setItems(r.items)).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = event.currentTarget;
    try {
      await api("/users", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      setShow(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được tài khoản");
    }
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!editingUser) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.password) {
      delete data.password;
    }
    try {
      await api(`/users/${editingUser.id}`, { method: "PATCH", body: JSON.stringify(data) });
      setEditingUser(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được tài khoản");
    }
  }

  async function changeStatus(user: User, status: string) {
    await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    void load();
  }

  if (selectedUser) {
    return (
      <UserPoliciesList 
        user={selectedUser} 
        onBack={() => {
          setSelectedUser(null);
          void load();
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quản lý tài khoản CTV / Quản lý</h2>
          <p className="text-muted-foreground">Tạo tài khoản, sửa thông tin, khóa hoặc kích hoạt tài khoản hệ thống</p>
        </div>
        <Button onClick={() => { setShow(!show); setEditingUser(null); }}><Plus size={17}/>Thêm tài khoản</Button>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}

      {show && (
        <Card>
          <CardHeader>
            <CardTitle>Tạo tài khoản mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Họ tên</Label>
                  <Input name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label>Tên đăng nhập</Label>
                  <Input name="username" required />
                </div>
                <div className="space-y-2">
                  <Label>Số điện thoại</Label>
                  <Input name="phone" />
                </div>
                <div className="space-y-2">
                  <Label>Mật khẩu</Label>
                  <Input name="password" type="password" minLength={8} required />
                </div>
                <div className="space-y-2">
                  <Label>Vai trò</Label>
                  <Select name="role" required defaultValue="CTV">
                    <option value="CTV">CTV</option>
                    <option value="MANAGER">Quản lý</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShow(false)}>Hủy</Button>
                <Button>Tạo tài khoản</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editingUser && (
        <Card className="border-orange-200 bg-orange-50/10">
          <CardHeader>
            <CardTitle>Chỉnh sửa tài khoản: {editingUser.fullName}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateUser} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Họ tên</Label>
                  <Input name="fullName" defaultValue={editingUser.fullName} required />
                </div>
                <div className="space-y-2">
                  <Label>Tên đăng nhập</Label>
                  <Input name="username" defaultValue={editingUser.username} required />
                </div>
                <div className="space-y-2">
                  <Label>Số điện thoại</Label>
                  <Input name="phone" defaultValue={editingUser.phone || ""} />
                </div>
                <div className="space-y-2">
                  <Label>Mật khẩu mới (để trống nếu không đổi)</Label>
                  <Input name="password" type="password" minLength={8} placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label>Vai trò</Label>
                  <Select name="role" required defaultValue={editingUser.role}>
                    <option value="CTV">CTV</option>
                    <option value="MANAGER">Quản lý</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <Select name="status" required defaultValue={editingUser.status || "ACTIVE"}>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="INACTIVE">Tạm ngưng</option>
                    <option value="LOCKED">Đã khóa</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Hủy</Button>
                <Button>Lưu thay đổi</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="p-3">Họ & Tên</th>
                <th className="p-3">Vai trò</th>
                <th className="p-3 text-center">Đã phát hành</th>
                <th className="p-3 text-right">Doanh số</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Ngày tạo</th>
                <th className="p-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr className="border-t" key={user.id}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-orange-700">
                        <UserRoundCog size={17}/>
                      </div>
                      <div>
                        <div 
                          className="font-medium hover:underline cursor-pointer text-orange-700" 
                          onClick={() => setSelectedUser(user)}
                        >
                          {user.fullName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user.username} {user.phone && `• ${user.phone}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge className={user.role === "ADMIN" ? "bg-purple-50 text-purple-700 border border-purple-200" : user.role === "MANAGER" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-stone-50 text-stone-700 border border-stone-200"}>
                      {user.role === "ADMIN" ? "Admin" : user.role === "MANAGER" ? "Quản lý" : "CTV"}
                    </Badge>
                  </td>
                  <td className="p-3 text-center font-semibold">{user.stats?.count ?? 0} thẻ</td>
                  <td className="p-3 text-right font-mono text-emerald-600 font-semibold">{user.stats?.premium ? money(user.stats.premium) : "0đ"}</td>
                  <td className="p-3">
                    <Badge className={user.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                      {user.status === "ACTIVE" ? "Hoạt động" : "Tạm ngưng / Khóa"}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{dateTime(user.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Select className="w-32" value={user.status} onChange={(e) => changeStatus(user, e.target.value)}>
                        <option value="ACTIVE">Hoạt động</option>
                        <option value="INACTIVE">Tạm ngưng</option>
                        <option value="LOCKED">Đã khóa</option>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingUser(user); setShow(false); }}>
                        <Edit3 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function UserPoliciesList({ user, onBack }: { user: User; onBack: () => void }) {
  const [items, setItems] = useState<Policy[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const getRecentMonths = () => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const y = d.getFullYear();
      list.push({ label: `Tháng ${m}/${y}`, month: m, year: y });
    }
    return list;
  };
  const monthsList = getRecentMonths();

  const load = () => {
    setLoading(true);
    let url = `/policies?userId=${user.id}&q=${encodeURIComponent(q)}&status=${status}`;
    if (selectedMonth && selectedYear) {
      url += `&month=${selectedMonth}&year=${selectedYear}`;
    }
    api<{ items: Policy[] }>(url)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const copyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const cleanPlateForFilename = (plate: string) => {
    return plate.toUpperCase().replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  };

  const cleanGCN = (gcn: string | null | undefined) => {
    if (!gcn) return "—";
    const parts = gcn.split("_");
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      return lastPart.replace(/\.pdf$/i, "");
    }
    return gcn.replace(/\.pdf$/i, "");
  };

  useEffect(load, [status, selectedMonth, selectedYear]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedMonth("");
      setSelectedYear("");
    } else {
      const [m, y] = val.split("-");
      setSelectedMonth(m);
      setSelectedYear(y);
    }
  };

  const exportUrl = `/policies/export?userId=${user.id}&month=${selectedMonth}&year=${selectedYear}`;

  const statusStyle: Record<string, string> = {
    ISSUED: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    QUEUED: "bg-amber-100 text-amber-700",
  };
  const statusText: Record<string, string> = {
    ISSUED: "Đã phát hành",
    FAILED: "Thất bại",
    PROCESSING: "Đang xử lý",
    QUEUED: "Chờ xử lý",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} className="h-10 w-10">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Lịch sử cấp đơn: {user.fullName}</h2>
            <p className="text-stone-500">Tài khoản: {user.username} · {user.stats?.count ?? 0} thẻ · Doanh số: {user.stats?.premium ? money(user.stats.premium) : "0đ"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Input 
            placeholder="Biển số, họ tên..." 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            onKeyDown={(e) => e.key === "Enter" && load()} 
            className="col-span-2 sm:w-60"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Mọi trạng thái</option>
            <option value="QUEUED">Chờ xử lý</option>
            <option value="PROCESSING">Đang xử lý</option>
            <option value="ISSUED">Đã phát hành</option>
            <option value="FAILED">Thất bại</option>
          </Select>
          <Select value={selectedMonth ? `${selectedMonth}-${selectedYear}` : ""} onChange={handleMonthChange}>
            <option value="">Tất cả thời gian</option>
            {monthsList.map((item) => (
              <option key={`${item.month}-${item.year}`} value={`${item.month}-${item.year}`}>{item.label}</option>
            ))}
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => download(exportUrl, `danh_sach_${user.username}_${selectedMonth || "all"}.xlsx`)} 
            className="flex items-center gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 h-10 px-3"
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </Button>
          <Button variant="outline" size="icon" onClick={load} className="h-10 w-10">
            <RefreshCw size={17} />
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      
      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="p-3">Khách hàng</th>
                <th className="p-3">Biển số</th>
                <th className="p-3">GCN</th>
                <th className="p-3">Phí</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Ngày tạo</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{p.customerName}</div>
                  </td>
                  <td className="p-3 font-mono">{p.plateNumber}</td>
                  <td className="p-3 font-mono text-xs">{cleanGCN(p.certificateNumber)}</td>
                  <td className="p-3">{p.premium ? money(p.premium) : "—"}</td>
                  <td className="p-3">
                    <Badge className={statusStyle[p.status]}>{statusText[p.status]}</Badge>
                    {p.status !== "ISSUED" && p.error && <div className="mt-1 max-w-xs truncate text-xs text-red-600" title={p.error}>{p.error}</div>}
                  </td>
                  <td className="p-3 text-muted-foreground">{dateTime(p.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {p.pdfPath && (
                        <Button size="sm" variant="outline" onClick={() => download(`/policies/${p.id}/pdf`, `${cleanPlateForFilename(p.plateNumber)}.pdf`)}>
                          <Download size={15} /> Tải xuống
                        </Button>
                      )}
                      {p.pdfUrl && (
                        <Button size="sm" variant="outline" onClick={() => copyLink(p.id, p.pdfUrl!)} className="flex items-center gap-1">
                          {copiedId === p.id ? (
                            <>
                              <Check size={13} className="text-emerald-600" /> Đã chép
                            </>
                          ) : (
                            <>
                              <Copy size={13} /> Copy link
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !items.length && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">Chưa có đơn nào</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">Đang tải…</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
