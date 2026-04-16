type OrderTab =
  | "all"
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "returned"
  | "cancelled";

type Props = {
  initialTab?: OrderTab;
};

export default function OrdersList({ initialTab = "all" }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const [tab, setTab] = useState<OrderTab>(initialTab);

  const { data: orders = [], isLoading } = useSWR(
    "/api/seller/orders",
    fetcher
  );

  /* ================= FILTER ================= */

  const filtered = useMemo(() => {
    if (tab === "all") return orders;
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  /* ================= TABS CONFIG ================= */

  const tabs: [OrderTab, string][] = [
    ["all", t.all ?? "All"],
    ["pending", t.pending_orders ?? "Pending"],
    ["confirmed", t.confirmed_orders ?? "Confirmed"],
    ["shipping", t.shipping_orders ?? "Shipping"],
    ["completed", t.completed_orders ?? "Completed"],
    ["returned", t.returned_orders ?? "Returned"],
    ["cancelled", t.cancelled_orders ?? "Cancelled"],
  ];

  return (
    <div>

      {/* ================= TABS ================= */}
      <div className="bg-white border-b">
        <div className="flex gap-6 px-4 py-3 text-sm overflow-x-auto whitespace-nowrap">

          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`
                pb-2 border-b-2 transition
                ${
                  tab === key
                    ? "border-black font-semibold"
                    : "border-transparent text-gray-400"
                }
              `}
            >
              {label}
            </button>
          ))}

        </div>
      </div>

      {/* ================= LIST ================= */}

      <div className="p-4 space-y-4">

        {filtered.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onClick={() => router.push(`/seller/orders/${order.id}`)}
          />
        ))}

      </div>

    </div>
  );
}
