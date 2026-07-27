"use client";

import { useState } from "react";
import { approveKycAction } from "@/app/actions/kyc";

interface KycUser {
  id: string;
  name: string;
  email: string;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
}

// Example data — replace or pass real users from server side/props
const initialUsers: KycUser[] = [
  {
    id: "user_123",
    name: "Alex Johnson",
    email: "alex@example.com",
    kycStatus: "PENDING",
    submittedAt: "2026-07-25",
  },
  {
    id: "user_456",
    name: "Sam Smith",
    email: "sam@example.com",
    kycStatus: "PENDING",
    submittedAt: "2026-07-26",
  },
];

export default function AdminKycPage() {
  const [users, setUsers] = useState<KycUser[]>(initialUsers);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleApprove = async (userId: string) => {
    setLoadingId(userId);
    setNotification(null);

    try {
      // Calls server action: updates DB status & fires off Resend email
      const response = await approveKycAction(userId);

      if (response.success) {
        setNotification({
          type: "success",
          message: "KYC approved and verification email sent successfully!",
        });

        // Update local table state
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, kycStatus: "APPROVED" } : user
          )
        );
      } else {
        setNotification({
          type: "error",
          message: response.error || "Failed to approve KYC application.",
        });
      }
    } catch (error) {
      setNotification({
        type: "error",
        message: "An unexpected error occurred while processing the request.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">KYC Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review pending identity verification submissions and notify users.
        </p>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-md text-sm font-medium ${
            notification.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Submitted
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  No KYC verification requests found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.kycStatus === "APPROVED"
                          ? "bg-green-100 text-green-800"
                          : user.kycStatus === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {user.kycStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.submittedAt}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {user.kycStatus === "PENDING" ? (
                      <button
                        onClick={() => handleApprove(user.id)}
                        disabled={loadingId === user.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1.5 px-3 rounded text-xs transition-opacity disabled:opacity-50"
                      >
                        {loadingId === user.id ? "Approving & Emailing..." : "Approve KYC"}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs font-medium">Completed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
