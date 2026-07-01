import { Save } from "lucide-react";
import { useState, FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../components/ui";
import type { User } from "../lib/types";

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const updated = await api<User>("/users/profile", {
        method: "PATCH",
        body: JSON.stringify({ fullName, phone })
      });
      updateUser(updated);
      setMessage({ ok: true, text: "Cập nhật thông tin tài khoản thành công!" });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Không thể cập nhật tài khoản"
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Thông tin tài khoản</h2>
        <p className="text-muted-foreground">Xem và chỉnh sửa thông tin cá nhân của bạn</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chỉnh sửa thông tin cá nhân</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-4">
              
              <div className="space-y-2">
                <Label htmlFor="username">Tên đăng nhập (Không thể thay đổi)</Label>
                <Input id="username" value={user?.username ?? ""} disabled className="bg-stone-100" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Họ và tên</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Nhập số điện thoại" />
              </div>

              <div className="space-y-2">
                <Label>Chức vụ</Label>
                <Input value={user?.role === "ADMIN" ? "Quản trị viên" : user?.role === "MANAGER" ? "Quản lý" : "Cộng tác viên"} disabled className="bg-stone-100" />
              </div>

            </div>

            {message && (
              <p className={`rounded-lg p-3 text-sm font-medium ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {message.text}
              </p>
            )}

            <Button disabled={busy} className="flex items-center gap-2">
              <Save size={16} />
              {busy ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
