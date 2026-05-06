import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function PendingPage() {
  return (
    <Card className="border-0 shadow-2xl rounded-2xl overflow-hidden text-center">
      <CardHeader className="pb-2 pt-8">
        <Image
          src="/srsf-logo.png"
          alt="SRSF"
          width={72}
          height={72}
          className="mx-auto mb-3"
        />
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-srsf-purple-100 flex items-center justify-center">
          <Clock className="w-5 h-5 text-srsf-purple-600" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">
          Account Pending Approval
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <p className="text-sm text-gray-500 leading-relaxed">
          Your account is awaiting administrator approval. You&apos;ll receive
          an email once access has been granted.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          If you believe this is an error, please contact your system
          administrator.
        </p>
      </CardContent>
    </Card>
  );
}
