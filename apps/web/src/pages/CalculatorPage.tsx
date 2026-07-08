import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Input, Label } from "../components/ui";
import { money } from "../lib/utils";
import { Calculator, Coins, Percent, Shield, ArrowRightLeft } from "lucide-react";

export function CalculatorPage() {
  // Thân vỏ / Vật chất xe
  const [tvTotal, setTvTotal] = useState<number>(0);
  const [tvComm, setTvComm] = useState<number>(0);

  // TNDS
  const [tndsPremium, setTndsPremium] = useState<number>(0);
  const [tndsPassenger, setTndsPassenger] = useState<number>(0);
  const [tndsComm, setTndsComm] = useState<number>(0);

  // Định dạng số tiền nhập liệu (ví dụ: 4400000 -> 4.400.000)
  const formatInput = (num: number) => {
    if (!num) return "";
    return num.toLocaleString("vi-VN");
  };

  const parseInput = (val: string) => {
    const clean = val.replace(/\D/g, "");
    return clean ? Number(clean) : 0;
  };

  // Tính toán Thân vỏ
  const tvNetBeforeTax = tvTotal / 1.1;
  const tvCommissionVal = tvNetBeforeTax * (tvComm / 100);
  const tvPayable = tvTotal - tvCommissionVal;

  // Tính toán TNDS
  const tndsNetBeforeTax = tndsPremium / 1.1;
  const tndsDiscountable = tndsNetBeforeTax + tndsPassenger;
  const tndsCommissionVal = tndsDiscountable * (tndsComm / 100);
  const tndsTotalPremium = tndsPremium + tndsPassenger;
  const tndsPayable = tndsTotalPremium - tndsCommissionVal;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-black text-stone-800 flex items-center gap-2">
          <Calculator className="text-orange-600 h-6 w-6" />
          Tính phí nộp về
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Nhập thông tin phí và % hoa hồng để tính tiền thực tế cần nộp về.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* CARD THÂN VỎ / VẬT CHẤT XE */}
        <Card className="border-t-4 border-t-orange-500 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-stone-100 bg-stone-50/50">
            <CardTitle className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
              <Shield className="text-orange-500 h-4.5 w-4.5" />
              Thân vỏ / Vật chất xe
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tvTotal" className="text-xs text-stone-600 font-semibold">Tổng phí bảo hiểm (đã gồm VAT)</Label>
              <div className="relative">
                <Input
                  id="tvTotal"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ví dụ: 1.100.000"
                  value={formatInput(tvTotal)}
                  onChange={(e) => setTvTotal(parseInput(e.target.value))}
                  className="pl-3 pr-12 h-9 text-sm font-bold text-stone-800"
                />
                <span className="absolute right-3 top-2 text-stone-400 text-xs font-bold">VND</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tvComm" className="text-xs text-stone-600 font-semibold">Tỷ lệ hoa hồng (%)</Label>
              <div className="relative">
                <Input
                  id="tvComm"
                  type="number"
                  placeholder="Ví dụ: 10"
                  value={tvComm || ""}
                  onChange={(e) => setTvComm(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="pl-3 pr-10 h-9 text-sm font-bold text-stone-800"
                />
                <span className="absolute right-3 top-2 text-stone-400 text-xs"><Percent size={14} /></span>
              </div>
            </div>

            {/* KẾT QUẢ TÍNH TOÁN THÂN VỎ */}
            <div className="mt-4 rounded-lg bg-orange-50/50 border border-orange-100 p-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-600 font-medium">Tiền hoa hồng chiết khấu:</span>
                <span className="font-bold text-stone-800">{money(tvCommissionVal)}</span>
              </div>

              <div className="border-t border-dashed border-orange-200 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-stone-700">Phí thực tế nộp về:</span>
                <span className="text-base font-black text-orange-600">{money(tvPayable)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD TNDS */}
        <Card className="border-t-4 border-t-blue-500 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-stone-100 bg-stone-50/50">
            <CardTitle className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
              <Coins className="text-blue-500 h-4.5 w-4.5" />
              Bảo hiểm TNDS & Lái phụ xe
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tndsPremium" className="text-xs text-stone-600 font-semibold">Phí bảo hiểm TNDS (đã gồm VAT)</Label>
              <div className="relative">
                <Input
                  id="tndsPremium"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ví dụ: 437.000"
                  value={formatInput(tndsPremium)}
                  onChange={(e) => setTndsPremium(parseInput(e.target.value))}
                  className="pl-3 pr-12 h-9 text-sm font-bold text-stone-800"
                />
                <span className="absolute right-3 top-2 text-stone-400 text-xs font-bold">VND</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tndsPassenger" className="text-xs text-stone-600 font-semibold">Phí Lái phụ & Người ngồi xe (LP NNTX)</Label>
              <div className="relative">
                <Input
                  id="tndsPassenger"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ví dụ: 50.000"
                  value={formatInput(tndsPassenger)}
                  onChange={(e) => setTndsPassenger(parseInput(e.target.value))}
                  className="pl-3 pr-12 h-9 text-sm font-bold text-stone-800"
                />
                <span className="absolute right-3 top-2 text-stone-400 text-xs font-bold">VND</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tndsComm" className="text-xs text-stone-600 font-semibold">Tỷ lệ hoa hồng (%)</Label>
              <div className="relative">
                <Input
                  id="tndsComm"
                  type="number"
                  placeholder="Ví dụ: 20"
                  value={tndsComm || ""}
                  onChange={(e) => setTndsComm(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="pl-3 pr-10 h-9 text-sm font-bold text-stone-800"
                />
                <span className="absolute right-3 top-2 text-stone-400 text-xs"><Percent size={14} /></span>
              </div>
            </div>

            {/* KẾT QUẢ TÍNH TOÁN TNDS */}
            <div className="mt-4 rounded-lg bg-blue-50/50 border border-blue-100 p-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-600 font-medium">Tiền hoa hồng chiết khấu:</span>
                <span className="font-bold text-stone-800">{money(tndsCommissionVal)}</span>
              </div>

              <div className="border-t border-dashed border-blue-200 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-stone-700">Phí thực tế nộp về:</span>
                <span className="text-base font-black text-blue-600">{money(tndsPayable)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* THÔNG TIN HƯỚNG DẪN CÔNG THỨC */}
      <Card className="bg-stone-50 border border-stone-200 shadow-none">
        <CardContent className="p-3 flex items-start gap-2">
          <ArrowRightLeft className="text-stone-400 shrink-0 mt-0.5" size={16} />
          <div className="text-[10px] text-stone-500 space-y-0.5 leading-relaxed">
            <div className="font-bold text-stone-700">Công thức nộp về:</div>
            <div>• <b>Thân vỏ / Vật chất xe:</b> Phí nộp về = <code>Tổng phí - (Tổng phí / 1.1 * Hoa hồng%)</code></div>
            <div>• <b>TNDS & Người ngồi:</b> Phí nộp về = <code>(Phí TNDS + LP NNTX) - ((Phí TNDS / 1.1 + LP NNTX) * Hoa hồng%)</code></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
