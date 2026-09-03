import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminTeamsPanel from "@/components/admin/AdminTeamsPanel";

export default function AdminTeamsPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Button asChild variant="ghost" size="icon">
          <Link to="/admin" aria-label="Back to admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <AdminTeamsPanel />
      </div>
    </div>
  );
}
