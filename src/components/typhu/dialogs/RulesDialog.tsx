"use client";

import { JAIL_FINE } from "@/lib/typhu/board";
import { Modal, money } from "../shared";

// ─── Rules ──────────────────────────────────────────────────────────

export function TyPhuRules() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      <li>2–6 người, mỗi người bắt đầu với số tiền chủ bàn chọn (mặc định 1.500tr). Mỗi vòng qua Khởi hành nhận 200tr (chủ bàn chỉnh được).</li>
      <li>Tung 2 xúc xắc rồi đi. Tung đôi được tung tiếp; đôi 3 lần liền thì vào tù.</li>
      <li>Dừng ở đất, sân bay hay công ty chưa có chủ thì được mua. Không mua thì đất vẫn thuộc ngân hàng — trừ khi bàn bật luật Đấu giá (bên dưới).</li>
      <li>
        Luật <b>Đấu giá</b> (chủ bàn bật, mặc định tắt): ô không ai mua (bỏ qua hoặc hết giờ) được đem ra đấu giá, <b>ai còn trong ván cũng được trả giá</b>, kể cả người vừa bỏ qua. Khởi điểm bằng 50% giá đất; mỗi lần trả phải cao hơn giá hiện tại ít nhất 10tr
        và bằng <b>tiền mặt</b> đang có (không thế chấp để trả giá); người đang dẫn đầu không tự nâng giá của mình. Đồng hồ 15 giây, mỗi lần có người trả thêm 5 giây (tối đa còn 15 giây). Hết giờ, người trả cao nhất đưa tiền cho ngân hàng và nhận đất; không ai trả thì đất vẫn của ngân hàng. Lượt chơi tạm dừng trong lúc đấu giá
        (không đổi đất, vay hay thế chấp được) rồi tiếp tục như thường.
      </li>
      <li>Dừng ở đất người khác thì trả tiền thuê. Có đủ cả nhóm màu thì tiền thuê ×2 và được xây nhà — xây đều từng ô, 4 nhà rồi lên khách sạn.</li>
      <li>
        Luật nhà (chủ bàn chọn): <b>xây đều</b>, hoặc <b>xây theo chuỗi</b> — nhà 1 xây bình thường, nhà 2 cần ít nhất 2 ô trong nhóm đã có nhà 1, nhà 3 cần 2 ô đã có
        nhà 2, nhà 4 cần mọi ô trong nhóm có 3 nhà, khách sạn cần mọi ô có 4 nhà. Có thể bỏ điều kiện đủ nhóm màu.
      </li>
      <li>Mỗi căn nhà xây sau trên cùng ô đắt hơn căn trước 25% (khách sạn gấp đôi giá nhà đầu; chủ bàn có thể tắt để căn nào cũng một giá); bán lại được nửa giá căn đó. Nếu bàn cho phép, bán đất (không còn nhà) cho ngân hàng được 70% giá (chỉnh được 50–90%) — nhiều hơn thế chấp nhưng mất đất, đất về chợ cho ai dừng ở đó mua lại.</li>
      <li>Phá sản: tiền còn lại về tay chủ nợ; đất trả về ngân hàng để người khác mua như bình thường (hoặc về tay chủ nợ, tuỳ luật bàn).</li>
      <li>Sân bay: càng nhiều sân bay càng thu nhiều (25 → 200tr). Điện / nước: tổng xúc xắc × 4, có cả hai thì × 10.</li>
      <li>Thiếu tiền: bán nhà (được nửa giá) hoặc thế chấp đất (nhận 50% giá, chuộc lại phải trả thêm 10% — chủ bàn chỉnh được). Không xoay nổi thì phá sản.</li>
      <li>Ở tù: tung đôi để ra, hoặc nộp {money(JAIL_FINE)} / dùng thẻ ra tù trước khi tung. Sau 3 lượt thì phải nộp phạt.</li>
      <li>Đổi đất với nhau bất cứ lúc nào, trừ lúc đang đấu giá (kèm tiền nếu muốn); đất có nhà đổi được, nhà đi theo đất. Người còn lại cuối cùng — hoặc giàu nhất khi hết giờ — thắng.</li>
      <li>Mỗi bước có thời gian chủ bàn chọn (mặc định 30 giây); hết giờ hoặc mất kết nối thì máy tự đi (không mua gì; nếu bàn có Đấu giá thì ô đó được đem ra đấu giá).</li>
    </ul>
  );
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} dark>
      <h2 className="mb-3 text-lg font-bold text-amber-300">📖 Luật Cờ Tỷ Phú</h2>
      <TyPhuRules />
    </Modal>
  );
}
