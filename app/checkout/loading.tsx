export default function CheckoutLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-gray-400">Đang xử lý thanh toán...</p>
    </div>
  );
}
