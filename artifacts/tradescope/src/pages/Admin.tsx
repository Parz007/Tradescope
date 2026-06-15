import { useState, useCallback } from "react";
import {
  useAdminLogin,
  useAdminGetStats,
  useAdminGetUsers,
  useAdminGetTodayAnalyses,
  useAdminUpdateTier,
  getAdminGetUsersQueryKey,
  getAdminGetStatsQueryKey,
  getAdminGetTodayAnalysesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Users, BarChart2, Activity, LogOut, ShoppingBag, RefreshCw, Check, X, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";

function getScoreColor(score: number) {
  if (score >= 86) return "#F0B429";
  if (score >= 66) return "#3B82F6";
  if (score >= 41) return "#F59E0B";
  return "#EF4444";
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: "Pending",   color: "#F59E0B", bg: "#F59E0B20" },
  payment_received: { label: "Payment ✓", color: "#3B82F6", bg: "#3B82F620" },
  completed:        { label: "Completed", color: "#10B981", bg: "#10B98120" },
  cancelled:        { label: "Cancelled", color: "#EF4444", bg: "#EF444420" },
  available:        { label: "Available", color: "#10B981", bg: "#10B98120" },
  reserved:         { label: "Reserved",  color: "#F59E0B", bg: "#F59E0B20" },
  sold:             { label: "Sold",      color: "#64748B", bg: "#64748B20" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#64748B", bg: "#64748B20" };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

interface MarketOrder {
  id: string;
  listingId: string;
  accountSize: number;
  buyerUserId: string;
  buyerUsername: string | null;
  buyerContact: string | null;
  cryptoType: string;
  amountUsd: number;
  txHash: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
}

interface MarketListing {
  id: string;
  accountSize: number;
  accountType: string;
  priceUsd: number;
  title: string;
  status: string;
  featured: number;
}

function MarketTab({ token }: { token: string }) {
  const [activeView, setActiveView] = useState<"orders" | "listings">("orders");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [walletConfig, setWalletConfig] = useState({ btc: "", eth: "", trc20: "" });

  const ordersQuery = useQuery<MarketOrder[]>({
    queryKey: ["admin-market-orders"],
    queryFn: async () => {
      const r = await fetch("/api/admin/marketplace/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json() as Promise<MarketOrder[]>;
    },
    enabled: activeView === "orders",
  });

  const listingsQuery = useQuery<MarketListing[]>({
    queryKey: ["admin-market-listings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/marketplace/listings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json() as Promise<MarketListing[]>;
    },
    enabled: activeView === "listings",
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const r = await fetch(`/api/admin/marketplace/order/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      return r.json();
    },
    onSuccess: () => ordersQuery.refetch(),
  });

  const updateListingMutation = useMutation({
    mutationFn: async ({ listingId, status, featured }: { listingId: string; status?: string; featured?: number }) => {
      const r = await fetch(`/api/admin/marketplace/listing/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, featured }),
      });
      return r.json();
    },
    onSuccess: () => listingsQuery.refetch(),
  });

  async function handleOrderAction(orderId: string, status: string) {
    setUpdatingId(orderId);
    await updateOrderMutation.mutateAsync({ orderId, status });
    setUpdatingId(null);
  }

  const orders = ordersQuery.data ?? [];
  const listings = listingsQuery.data ?? [];
  const pending = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 text-center">
          <p className="font-display font-bold text-xl text-[#F59E0B]">{pending}</p>
          <p className="text-[#64748B] text-[10px] mt-0.5">Pending</p>
        </div>
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 text-center">
          <p className="font-display font-bold text-xl text-[#10B981]">
            {orders.filter((o) => o.status === "completed").length}
          </p>
          <p className="text-[#64748B] text-[10px] mt-0.5">Completed</p>
        </div>
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 text-center">
          <p className="font-display font-bold text-xl text-[#3B82F6]">
            {listings.filter((l) => l.status === "available").length || "—"}
          </p>
          <p className="text-[#64748B] text-[10px] mt-0.5">Available</p>
        </div>
      </div>

      {/* Admin guide */}
      <div className="rounded-xl bg-[#0D1117] border border-[#F0B429]/30 p-4 text-xs space-y-2">
        <p className="text-[#F0B429] font-semibold flex items-center gap-1.5">🔑 Admin Escrow Guide</p>
        <p className="text-[#94A3B8]"><span className="text-[#F1F5F9] font-medium">1. Pending order arrives</span> → Buyer has sent crypto. Check your wallet for the payment.</p>
        <p className="text-[#94A3B8]"><span className="text-[#F1F5F9] font-medium">2. Verify on-chain</span> → Use the TX hash to confirm payment on blockchain explorer. Verify USD amount matches.</p>
        <p className="text-[#94A3B8]"><span className="text-[#F1F5F9] font-medium">3. Mark "Payment ✓"</span> → Update order status, then DM buyer their FTMO credentials via Telegram.</p>
        <p className="text-[#94A3B8]"><span className="text-[#F1F5F9] font-medium">4. Buyer confirms receipt</span> → Once buyer confirms, mark order "Completed". The listing becomes "Sold".</p>
        <p className="text-[#94A3B8]"><span className="text-[#F1F5F9] font-medium">5. Cancel if needed</span> → Cancelling returns the listing to "Available" for new buyers.</p>
        <div className="border-t border-[#1E2736] pt-2 mt-2">
          <p className="text-[#64748B]">💡 Set crypto wallet env vars: <code className="text-[#F0B429]">CRYPTO_BTC_ADDRESS</code>, <code className="text-[#F0B429]">CRYPTO_ETH_ADDRESS</code>, <code className="text-[#F0B429]">CRYPTO_USDT_TRC20_ADDRESS</code></p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-[#0D1117] border border-[#1E2736] rounded-xl p-1">
        <button
          onClick={() => setActiveView("orders")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeView === "orders" ? "bg-[#F0B429] text-[#080B14]" : "text-[#64748B]"}`}
        >
          Orders {pending > 0 && <span className="ml-1 bg-[#EF4444] text-white text-[10px] rounded-full px-1.5 py-0.5">{pending}</span>}
        </button>
        <button
          onClick={() => setActiveView("listings")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeView === "listings" ? "bg-[#F0B429] text-[#080B14]" : "text-[#64748B]"}`}
        >
          Listings
        </button>
      </div>

      {/* Orders */}
      {activeView === "orders" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[#64748B] text-xs">{orders.length} total orders</p>
            <button onClick={() => ordersQuery.refetch()} className="text-[#64748B] hover:text-[#F0B429] transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {ordersQuery.isLoading && <p className="text-[#64748B] text-sm text-center py-6">Loading...</p>}
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#F1F5F9] font-semibold text-sm">
                    ${(order.accountSize / 1000).toFixed(0)}K Account
                  </p>
                  <p className="text-[#64748B] text-xs mt-0.5">
                    {order.buyerContact ?? order.buyerUsername ?? order.buyerUserId}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div>
                  <span className="text-[#64748B]">Amount: </span>
                  <span className="text-[#F1F5F9] font-semibold">${order.amountUsd}</span>
                </div>
                <div>
                  <span className="text-[#64748B]">Crypto: </span>
                  <span className="text-[#F1F5F9]">{order.cryptoType.replace("_", " ")}</span>
                </div>
                {order.txHash && (
                  <div className="col-span-2">
                    <span className="text-[#64748B]">TX: </span>
                    <span className="text-[#F1F5F9] font-mono text-[10px] break-all">{order.txHash}</span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-[#64748B]">Date: </span>
                  <span className="text-[#F1F5F9]">{new Date(order.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {order.status !== "completed" && order.status !== "cancelled" && (
                <div className="flex gap-2 mt-1">
                  {order.status === "pending" && (
                    <button
                      onClick={() => handleOrderAction(order.id, "payment_received")}
                      disabled={updatingId === order.id}
                      className="flex-1 py-2 rounded-lg bg-[#3B82F6]/20 text-[#3B82F6] text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <Check className="w-3 h-3 inline mr-1" />Payment ✓
                    </button>
                  )}
                  {order.status === "payment_received" && (
                    <button
                      onClick={() => handleOrderAction(order.id, "completed")}
                      disabled={updatingId === order.id}
                      className="flex-1 py-2 rounded-lg bg-[#10B981]/20 text-[#10B981] text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <Check className="w-3 h-3 inline mr-1" />Complete
                    </button>
                  )}
                  <button
                    onClick={() => handleOrderAction(order.id, "cancelled")}
                    disabled={updatingId === order.id}
                    className="flex-1 py-2 rounded-lg bg-[#EF4444]/10 text-[#EF4444] text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <X className="w-3 h-3 inline mr-1" />Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
          {!ordersQuery.isLoading && orders.length === 0 && (
            <p className="text-[#64748B] text-center py-8 text-sm">No orders yet</p>
          )}
        </div>
      )}

      {/* Listings */}
      {activeView === "listings" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[#64748B] text-xs">{listings.length} listings</p>
            <button onClick={() => listingsQuery.refetch()} className="text-[#64748B] hover:text-[#F0B429] transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {listingsQuery.isLoading && <p className="text-[#64748B] text-sm text-center py-6">Loading...</p>}
          {listings.map((listing) => (
            <div key={listing.id} className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[#F0B429] font-bold font-display">${(listing.accountSize / 1000).toFixed(0)}K</p>
                  <span className="text-[#64748B] text-xs">{listing.accountType}</span>
                  {listing.featured === 1 && <span className="text-[10px] bg-[#F0B429]/20 text-[#F0B429] px-1.5 py-0.5 rounded-full">⭐</span>}
                </div>
                <p className="text-[#94A3B8] text-xs mt-0.5">${listing.priceUsd.toLocaleString()} USD</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={listing.status} />
                {listing.status === "available" ? (
                  <button
                    onClick={() => updateListingMutation.mutate({ listingId: listing.id, status: "sold" })}
                    className="text-[10px] px-2 py-1 rounded-lg bg-[#1E2736] text-[#64748B] hover:text-[#EF4444] transition-colors"
                  >
                    Remove
                  </button>
                ) : listing.status === "sold" ? (
                  <button
                    onClick={() => updateListingMutation.mutate({ listingId: listing.id, status: "available" })}
                    className="text-[10px] px-2 py-1 rounded-lg bg-[#1E2736] text-[#64748B] hover:text-[#10B981] transition-colors"
                  >
                    Restore
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!listingsQuery.isLoading && listings.length === 0 && (
            <p className="text-[#64748B] text-center py-8 text-sm">No listings found</p>
          )}
        </div>
      )}

      {/* Wallet config hint */}
      <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
        <p className="text-[#64748B] text-xs font-semibold mb-2 uppercase tracking-wider">Crypto Wallets</p>
        <p className="text-[#64748B] text-xs">Set these environment secrets in your Replit project settings:</p>
        <div className="mt-2 space-y-1">
          {["CRYPTO_BTC_ADDRESS", "CRYPTO_ETH_ADDRESS", "CRYPTO_USDT_TRC20_ADDRESS"].map((v) => (
            <p key={v} className="font-mono text-[10px] text-[#F0B429] bg-[#F0B429]/5 rounded px-2 py-1">{v}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem("admin_token") ?? "");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "activity" | "market">("overview");
  const [loginError, setLoginError] = useState("");
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const handleBack = useCallback(() => setLocation("/"), [setLocation]);
  useTelegramBackButton(handleBack);

  const adminLogin = useAdminLogin();
  const updateTier = useAdminUpdateTier();

  const isLoggedIn = !!token;

  const { data: stats } = useAdminGetStats({ query: { enabled: isLoggedIn, queryKey: getAdminGetStatsQueryKey() } });
  const { data: users } = useAdminGetUsers({ query: { enabled: isLoggedIn && activeTab === "users", queryKey: getAdminGetUsersQueryKey() } });
  const { data: todayAnalyses } = useAdminGetTodayAnalyses({ query: { enabled: isLoggedIn && activeTab === "activity", queryKey: getAdminGetTodayAnalysesQueryKey() } });

  function handleLogin() {
    setLoginError("");
    adminLogin.mutate(
      { data: { password } },
      {
        onSuccess: (res) => {
          localStorage.setItem("admin_token", res.token);
          setToken(res.token);
        },
        onError: () => setLoginError("Invalid password"),
      }
    );
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    setToken("");
  }

  function handleTierChange(userId: string, tier: string) {
    updateTier.mutate(
      { userId, data: { tier: tier as "free" | "pro" | "elite" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() }) }
    );
  }

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 gap-6">
      <div className="self-start">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-[#64748B] hover:text-[#F1F5F9] transition-colors active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
      </div>
      <div className="w-16 h-16 rounded-full bg-[#F0B429]/20 flex items-center justify-center">
        <Shield className="w-8 h-8 text-[#F0B429]" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-[#F1F5F9]">Admin Panel</h1>
        <p className="text-[#64748B] text-sm mt-1">Enter admin password to continue</p>
      </div>
      <div className="w-full space-y-3">
        <input
          type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          data-testid="input-admin-password"
          placeholder="Admin password"
          className="w-full bg-[#0D1117] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-4 py-3 focus:outline-none focus:border-[#F0B429]"
        />
        {loginError && <p className="text-[#EF4444] text-sm text-center">{loginError}</p>}
        <button
          onClick={handleLogin}
          disabled={adminLogin.isPending}
          data-testid="button-admin-login"
          className="w-full py-3 bg-[#F0B429] text-[#080B14] rounded-[20px] font-bold active:scale-95 transition-transform"
        >
          {adminLogin.isPending ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-4 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="text-[#64748B] hover:text-[#F1F5F9] transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-xl font-bold text-[#F1F5F9]">Admin Panel</h1>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-[#64748B] hover:text-[#EF4444] transition-colors text-sm">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-[#0D1117] border border-[#1E2736] rounded-xl p-1">
        {([
          { key: "overview", icon: BarChart2, label: "Stats" },
          { key: "users",    icon: Users,    label: "Users" },
          { key: "activity", icon: Activity, label: "Today" },
          { key: "market",   icon: ShoppingBag, label: "Market" },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            data-testid={`tab-${key}`}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === key ? "bg-[#F0B429] text-[#080B14]" : "text-[#64748B]"}`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Users", value: stats.totalUsers, color: "#F1F5F9" },
            { label: "Analyses Today", value: stats.analysesToday, color: "#F0B429" },
            { label: "Total Analyses", value: stats.totalAnalyses, color: "#3B82F6" },
            { label: "Free Users", value: stats.freeUsers, color: "#64748B" },
            { label: "Pro Users", value: stats.proUsers, color: "#3B82F6" },
            { label: "Elite Users", value: stats.eliteUsers, color: "#F0B429" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 text-center">
              <p className="font-display font-bold text-2xl" style={{ color }}>{value}</p>
              <p className="text-[#64748B] text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {activeTab === "users" && (
        <div className="flex flex-col gap-2">
          {users?.map((u) => (
            <div key={u.id} className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3" data-testid={`admin-user-${u.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#F1F5F9] font-medium text-sm">{u.firstName ?? "User"} {u.username ? `@${u.username}` : ""}</p>
                  <p className="text-[#64748B] text-xs mt-0.5">{u.totalAnalyses} analyses · {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <select
                  value={u.subscriptionTier}
                  onChange={(e) => handleTierChange(u.id, e.target.value)}
                  data-testid={`select-tier-${u.id}`}
                  className="bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#F0B429]"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                </select>
              </div>
            </div>
          ))}
          {!users?.length && <p className="text-[#64748B] text-center py-8">No users found</p>}
        </div>
      )}

      {/* Today Activity */}
      {activeTab === "activity" && (
        <div className="flex flex-col gap-2">
          {todayAnalyses?.map((a) => (
            <div key={a.id} className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#F1F5F9] font-medium text-sm">{a.pair}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${a.direction === "buy" ? "bg-[#10B981]/20 text-[#10B981]" : "bg-[#EF4444]/20 text-[#EF4444]"}`}>
                      {a.direction.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[#64748B] text-xs mt-0.5">{new Date(a.createdAt).toLocaleTimeString()}</p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: `${getScoreColor(a.overallScore)}20`, color: getScoreColor(a.overallScore) }}>
                  {a.overallScore}
                </div>
              </div>
            </div>
          ))}
          {!todayAnalyses?.length && <p className="text-[#64748B] text-center py-8">No analyses today yet</p>}
        </div>
      )}

      {/* Market */}
      {activeTab === "market" && <MarketTab token={token} />}

      <div className="pb-8" />
    </div>
  );
}
