"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Users,
  Building2,
  Star,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { get, post } from "@/lib/api";

interface SubscriptionStatus {
  plan: string;
  status: string;
  seat_count: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const plans = [
  {
    id: "pro",
    name: "Pro",
    price: "19",
    unit: "/month",
    description: "For individual presenters",
    icon: Zap,
    featured: false,
    cta: "Current Plan",
    ctaDisabled: true,
    features: [
      "10 sessions/month",
      "PDF & PPTX upload",
      "AI-generated cards",
      "Live speech-to-text",
      "Session replay",
      "PDF reports",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "24",
    unit: "/seat/month",
    description: "For small teams",
    icon: Users,
    featured: true,
    badge: "Most Popular",
    cta: "Upgrade to Team",
    ctaDisabled: false,
    features: [
      "Everything in Pro",
      "Unlimited sessions",
      "Team workspace",
      "Member management",
      "Priority support",
      "Q&A module",
      "Advanced analytics",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "45+",
    unit: "/seat/month",
    description: "For organizations",
    icon: Building2,
    featured: false,
    cta: "Contact Sales",
    ctaDisabled: false,
    features: [
      "Everything in Team",
      "Custom integrations",
      "SSO / SAML",
      "Dedicated support",
      "SLA guarantee",
      "Custom branding",
      "API access",
      "Webhook notifications",
    ],
  },
];

const comparisonFeatures = [
  { label: "Sessions per month", pro: "10", team: "Unlimited", enterprise: "Unlimited" },
  { label: "PDF & PPTX upload", pro: true, team: true, enterprise: true },
  { label: "AI-generated cards", pro: true, team: true, enterprise: true },
  { label: "Live speech-to-text", pro: true, team: true, enterprise: true },
  { label: "Session replay", pro: true, team: true, enterprise: true },
  { label: "PDF reports", pro: true, team: true, enterprise: true },
  { label: "Team workspace", pro: false, team: true, enterprise: true },
  { label: "Member management", pro: false, team: true, enterprise: true },
  { label: "Priority support", pro: false, team: true, enterprise: true },
  { label: "Q&A module", pro: false, team: true, enterprise: true },
  { label: "Advanced analytics", pro: false, team: true, enterprise: true },
  { label: "Custom integrations", pro: false, team: false, enterprise: true },
  { label: "SSO / SAML", pro: false, team: false, enterprise: true },
  { label: "Dedicated support", pro: false, team: false, enterprise: true },
  { label: "SLA guarantee", pro: false, team: false, enterprise: true },
  { label: "Custom branding", pro: false, team: false, enterprise: true },
  { label: "API access", pro: false, team: false, enterprise: true },
  { label: "Webhook notifications", pro: false, team: false, enterprise: true },
];

const faqs = [
  {
    q: "Can I try before I buy?",
    a: "Yes, start with our free demo session to explore all the core features. No credit card required.",
  },
  {
    q: "How does billing work?",
    a: "You can choose monthly or annual billing. Annual plans save you 20%. Invoices are generated automatically at the start of each billing cycle.",
  },
  {
    q: "Can I change plans?",
    a: "Absolutely. Upgrade or downgrade anytime from this page. Changes take effect immediately and billing is prorated.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards for Pro and Team plans. Enterprise customers can also pay via bank transfer.",
  },
];

const usageItems = [
  { label: "Sessions used this month", used: 3, limit: 10 },
  { label: "Documents uploaded", used: 5, limit: null },
  { label: "Team members", used: 1, limit: 1 },
];

/* ------------------------------------------------------------------ */
/*  Helper: comparison cell                                            */
/* ------------------------------------------------------------------ */

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm font-medium text-gray-900">{value}</span>;
  }
  return value ? (
    <Check size={18} className="text-[#D94228] mx-auto" />
  ) : (
    <X size={18} className="text-gray-300 mx-auto" />
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function BillingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    get<SubscriptionStatus>("/api/billing/subscription")
      .then(setSubscription)
      .catch(() => setSubscription({ plan: "free", status: "inactive", seat_count: 1, current_period_end: null, cancel_at_period_end: false }))
      .finally(() => setLoadingSub(false));
  }, []);

  const handleUpgrade = useCallback(async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const res = await post<{ url: string }>("/api/billing/checkout", {
        plan: planId,
        success_url: window.location.href,
        cancel_url: window.location.href,
      });
      if (res.url) window.location.href = res.url;
    } catch (err) {
      console.error("Checkout failed:", err);
    } finally {
      setCheckoutLoading(null);
    }
  }, []);

  const handleManageSubscription = useCallback(async () => {
    try {
      const res = await post<{ url: string }>("/api/billing/portal", {
        return_url: window.location.href,
      });
      if (res.url) window.location.href = res.url;
    } catch (err) {
      console.error("Portal failed:", err);
    }
  }, []);

  const currentPlan = subscription?.plan || "free";

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900">Plans &amp; Billing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Choose the plan that&#39;s right for your team
          </p>
        </div>

        {/* ---- Pricing Cards ---- */}
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                  plan.featured
                    ? "border-2 border-[#D94228] ring-1 ring-[#D94228]/10"
                    : "border border-gray-200"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#D94228] px-4 py-1 text-xs font-semibold text-white shadow">
                    {plan.badge}
                  </span>
                )}

                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      plan.featured
                        ? "bg-[#D94228]/10 text-[#D94228]"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-xs text-gray-500">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-gray-900">
                    &euro;{plan.price}
                  </span>
                  <span className="text-sm text-gray-500">{plan.unit}</span>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check
                        size={16}
                        className="mt-0.5 shrink-0 text-[#D94228]"
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={currentPlan === plan.id || checkoutLoading === plan.id}
                  onClick={() => {
                    if (currentPlan === plan.id) return;
                    if (plan.id === "enterprise") {
                      window.location.href = "mailto:sales@pretive.com?subject=Enterprise Plan";
                      return;
                    }
                    handleUpgrade(plan.id);
                  }}
                  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    currentPlan === plan.id
                      ? "border border-gray-300 text-gray-400 cursor-default"
                      : plan.featured
                      ? "bg-[#D94228] text-white hover:bg-[#c13a23]"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {checkoutLoading === plan.id ? (
                    <Loader2 size={14} className="mr-1.5 inline-block -mt-0.5 animate-spin" />
                  ) : currentPlan === plan.id ? (
                    <Star size={14} className="mr-1.5 inline-block -mt-0.5 text-[#D94228]" />
                  ) : null}
                  {currentPlan === plan.id ? "Current Plan" : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* ---- Usage Section ---- */}
        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Current Usage</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {usageItems.map((item) => (
              <div key={item.label}>
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {item.used}
                  {item.limit !== null && (
                    <span className="text-sm font-normal text-gray-400">
                      {" "}
                      / {item.limit}
                    </span>
                  )}
                </p>
                {item.limit !== null && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#D94228] transition-all"
                      style={{
                        width: `${Math.min(
                          (item.used / item.limit) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ---- Manage Subscription ---- */}
        {subscription && subscription.status === "active" && (
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/50 px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Active Plan: {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
              </p>
              {subscription.current_period_end && (
                <p className="text-xs text-gray-500">
                  {subscription.cancel_at_period_end ? "Cancels" : "Renews"} on{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={handleManageSubscription}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink size={14} />
              Manage Subscription
            </button>
          </div>
        )}

        {/* ---- Feature Comparison ---- */}
        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-bold text-gray-900">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 pr-4 font-medium text-gray-500 w-1/3">Feature</th>
                  <th className="pb-3 text-center font-medium text-gray-500 w-[22%]">Pro</th>
                  <th className="pb-3 text-center font-medium text-[#D94228] w-[22%]">Team</th>
                  <th className="pb-3 text-center font-medium text-gray-500 w-[22%]">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row, i) => (
                  <tr
                    key={row.label}
                    className={i < comparisonFeatures.length - 1 ? "border-b border-gray-50" : ""}
                  >
                    <td className="py-3 pr-4 text-gray-700">{row.label}</td>
                    <td className="py-3 text-center">
                      <Cell value={row.pro} />
                    </td>
                    <td className="py-3 text-center">
                      <Cell value={row.team} />
                    </td>
                    <td className="py-3 text-center">
                      <Cell value={row.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- FAQ ---- */}
        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-gray-100">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <button
                  key={i}
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="flex w-full items-start justify-between gap-4 py-4 text-left"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{faq.q}</p>
                    {isOpen && (
                      <p className="mt-2 text-sm leading-relaxed text-gray-600">
                        {faq.a}
                      </p>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronUp size={18} className="mt-0.5 shrink-0 text-gray-400" />
                  ) : (
                    <ChevronDown size={18} className="mt-0.5 shrink-0 text-gray-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
