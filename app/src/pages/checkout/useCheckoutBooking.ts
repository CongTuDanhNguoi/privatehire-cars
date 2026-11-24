// Tải một chuyến cho các màn checkout (giá, biên lai). Trả về trạng thái để trang tự hiển thị.
import { useEffect, useState } from "react";
import { getBooking, type CheckoutBooking } from "../../services/support";

export type CheckoutState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; booking: CheckoutBooking };

export function useCheckoutBooking(ref: string): CheckoutState {
  const [state, setState] = useState<CheckoutState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    void getBooking(ref).then((r) => {
      if (!active) return;
      setState(r.ok ? { status: "ready", booking: r.data.booking } : { status: "error", message: r.message });
    });
    return () => {
      active = false;
    };
  }, [ref]);
  return state;
}
