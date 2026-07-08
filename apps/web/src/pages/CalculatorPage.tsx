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
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-black text-stone-800 flex items-center gap-2">
          <Calculator className="text-orange-600 h-7 w-7" />
          Tính phí nộp về
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          Nhập thông tin biểu phí và phần trăm hoa hồng để tự động tính toán số tiền thực tế nộp về.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* CARD THÂN VỎ / VẬT CHẤT XE */}
        <Card className="border-t-4 border-t-orange-500 shadow-md">
          <CardHeader className="border-b border-stone-100 bg-stone-50/50">
            <CardTitle className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <Shield className="text-orange-500 h-5 w-5" />
              Thân vỏ / Vật chất xe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="tvTotal" className="text-stone-700 font-semibold">Tổng phí bảo hiểm (đã gồm VAT)</Label>
              <div className="relative">
                <Input
                  id="tvTotal"
                  type="number"
                  placeholder="Ví dụ: 1100000"
                  value={tvTotal || ""}
                  onChange={(e) => setTvTotal(Math.max(0, Number(e.target.value)))}
                  className="pl-3 pr-10 font-medium"
                />
                <span className="absolute right-3 top-2.5 text-stone-400 text-sm font-semibold">VND</span>
              </div>
              {tvTotal > 0 && (
                <div className="text-xs text-stone-500 font-medium">
                  Số tiền nhập: <span className="text-orange-600 font-bold">{money(tvTotal)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tvComm" className="text-stone-700 font-semibold">Tỷ lệ hoa hồng (%)</Label>
              <div className="relative">
                <Input
                  id="tvComm"
                  type="number"
                  placeholder="Ví dụ: 10"
                  value={tvComm || ""}
                  onChange={(e) => setTvComm(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="pl-3 pr-10 font-medium"
                />
                <span className="absolute right-3 top-2.5 text-stone-400 text-sm"><Percent size={16} /></span>
              </div>
            </div>

            {/* KẾT QUẢ TÍNH TOÁN THÂN VỎ */}
            <div className="mt-8 rounded-xl bg-orange-50/50 border border-orange-100 p-5 space-y-4">
              <div className="text-xs font-bold text-orange-800 uppercase tracking-wider">Breakdown chi tiết</div>
              
              <div className="grid grid-cols-2 gap-2 text-sm text-stone-600">
                <div>Phí trước thuế (Phí / 1.1):</div>
                <div className="text-right font-medium text-stone-800">{money(tvNetBeforeTax)}</div>
                
                <div>Tiền hoa hồng chiết khấu:</div>
                <div className="text-right font-medium text-stone-800">{money(tvCommissionVal)}</div>
              </div>

              <div className="border-t border-dashed border-orange-200 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-stone-700">Phí thực tế nộp về:</span>
                <span className="text-xl font-black text-orange-600">{money(tvPayable)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD TNDS */}
        <Card className="border-t-4 border-t-blue-500 shadow-md">
          <CardHeader className="border-b border-stone-100 bg-stone-50/50">
            <CardTitle className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <Coins className="text-blue-500 h-5 w-5" />
              Bảo hiểm TNDS & Lái phụ xe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="tndsPremium" className="text-stone-700 font-semibold">Phí bảo hiểm TNDS (đã gồm VAT)</Label>
              <div className="relative">
                <Input
                  id="tndsPremium"
                  type="number"
                  placeholder="Ví dụ: 437000"
                  value={tndsPremium || ""}
                  onChange={(e) => setTndsPremium(Math.max(0, Number(e.target.value)))}
                  className="pl-3 pr-10 font-medium"
                />
                <span className="absolute right-3 top-2.5 text-stone-400 text-sm font-semibold">VND</span>
              </div>
              {tndsPremium > 0 && (
                <div className="text-xs text-stone-500 font-medium">
                  Số tiền nhập: <span className="text-blue-600 font-bold">{money(tndsPremium)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tndsPassenger" className="text-stone-700 font-semibold">Phí Lái phụ & Người ngồi xe (LP NNTX)</Label>
              <div className="relative">
                <Input
                  id="tndsPassenger"
                  type="number"
                  placeholder="Ví dụ: 50000"
                  value={tndsPassenger || ""}
                  onChange={(e) => setTndsPassenger(Math.max(0, Number(e.target.value)))}
                  className="pl-3 pr-10 font-medium"
                />
                <span className="absolute right-3 top-2.5 text-stone-400 text-sm font-semibold">VND</span>
              </div>
              {tndsPassenger > 0 && (
                <div className="text-xs text-stone-500 font-medium">
                  Số tiền nhập: <span className="text-blue-600 font-bold">{money(tndsPassenger)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tndsComm" className="text-stone-700 font-semibold">Tỷ lệ hoa hồng (%)</Label>
              <div className="relative">
                <Input
                  id="tndsComm"
                  type="number"
                  placeholder="Ví dụ: 20"
                  value={tndsComm || ""}
                  onChange={(e) => setTndsComm(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="pl-3 pr-10 font-medium"
                />
                <span className="absolute right-3 top-2.5 text-stone-400 text-sm"><Percent size={16} /></span>
              </div>
            </div>

            {/* KẾT QUẢ TÍNH TOÁN TNDS */}
            <div className="mt-8 rounded-xl bg-blue-50/50 border border-blue-100 p-5 space-y-4">
              <div className="text-xs font-bold text-blue-800 uppercase tracking-wider">Breakdown chi tiết</div>

              <div className="grid grid-cols-2 gap-2 text-sm text-stone-600">
                <div>Tổng phí gốc (TNDS + LP):</div>
                <div className="text-right font-medium text-stone-800">{money(tndsTotalPremium)}</div>
                
                <div>Phí tính chiết khấu (TNDS/1.1 + LP):</div>
                <div className="text-right font-medium text-stone-800">{money(tndsDiscountable)}</div>
                
                <div>Tiền hoa hồng chiết khấu:</div>
                <div className="text-right font-medium text-stone-800">{money(tndsCommissionVal)}</div>
              </div>

              <div className="border-t border-dashed border-blue-200 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-stone-700">Phí thực tế nộp về:</span>
                <span className="text-xl font-black text-blue-600">{money(tndsPayable)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* THÔNG TIN HƯỚNG DẪN CÔNG THỨC */}
      <Card className="bg-stone-50 border border-stone-200">
        <CardContent className="p-5 flex items-start gap-3">
          <ArrowRightLeft className="text-stone-500 shrink-0 mt-0.5" size={20} />
          <div className="text-xs text-stone-600 space-y-1">
            <div className="font-bold text-stone-700">Công thức tính phí nộp về:</div>
            <div>• <b>Thân vỏ / Vật chất xe:</b> Phí nộp về = <code>Tổng phí - (Tổng phí / 1.1 * Hoa hồng%)</code></div>
            <div>• <b>TNDS & Người ngồi:</b> Phí nộp về = <code>(Phí TNDS + LP NNTX) - ((Phí TNDS / 1.1 + LP NNTX) * Hoa hồng%)</code></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
