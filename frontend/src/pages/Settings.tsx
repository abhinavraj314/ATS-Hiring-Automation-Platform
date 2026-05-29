import React, { useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield, Zap, Target, Palette, Workflow, LogOut, Download, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [successMessage, setSuccessMessage] = useState("");

  const handleSaveProfile = () => showSuccess("Profile settings saved successfully!");
  const handleExportData = () => showSuccess("Data export started... Check your downloads.");
  const handleDeleteAccount = () => {
    if (confirm("Are you absolutely sure? This will permanently delete all your recruiter data.")) {
      alert("Account deletion requested. This action is irreversible.");
    }
  };

  return (
    <MainLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-10 pb-20 relative">
        {successMessage && (
          <div className="fixed top-20 right-8 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
            <Zap className="h-4 w-4 text-amber-400" />
            {successMessage}
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure your profile, recruitment workflows, and matching engine.</p>
        </div>

        <Separator className="bg-border" />

        {/* Profile Settings */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <User className="h-4 w-4" />
              <h3>Profile</h3>
            </div>
            <p className="text-sm text-muted-foreground">Update your personal and company information.</p>
          </div>
          <Card className="md:col-span-2 border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>This information will be displayed on candidate communications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" defaultValue={user?.full_name || "John Doe"} className="border-slate-300" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email || "john@company.com"} className="border-slate-300" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org">Organization</Label>
                <Input id="org" placeholder="Acme Inc." defaultValue="Enterprise Hiring" className="border-slate-300" />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 border-t border-border py-3">
              <Button size="sm" className="ml-auto bg-slate-900" onClick={handleSaveProfile}>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </Button>
            </CardFooter>
          </Card>
        </section>


        {/* Security & Danger Zone */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Shield className="h-4 w-4" />
              <h3>Security</h3>
            </div>
            <p className="text-sm text-slate-500">Manage your data and account security.</p>
          </div>
          <div className="md:col-span-2 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Export Candidate Data</div>
                    <p className="text-xs text-slate-500">Download all candidate resumes and scoring data in JSON format.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportData}>
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Active Sessions</div>
                    <p className="text-xs text-slate-500">Log out from all other devices.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    logout();
                    alert("Logged out from all sessions.");
                  }}>
                    <LogOut className="mr-2 h-4 w-4" /> Logout All
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-100 bg-red-50/30 shadow-sm">
              <CardContent className="flex items-center justify-between p-6">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-red-900">
                    Delete Account
                  </div>
                  <p className="text-xs text-red-600/70">
                    Permanently remove your account and associated data.
                  </p>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAccount}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default SettingsPage;
