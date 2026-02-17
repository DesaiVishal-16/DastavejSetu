'use client';

import { ArrowLeft, Mail, User } from 'lucide-react';
import Link from 'next/link';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signup } from '@/lib/auth-client';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await signup(email, name);

    if (result.success) {
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      setError(result.message || 'Failed to create account');
    }

    setIsLoading(false);
  };

  return (
    <div
      data-theme="light"
      className="relative min-h-screen overflow-hidden bg-white"
    >
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-linear-to-br from-white via-[#124AB9]/3 to-[#124AB9]/5" />
        <div className="absolute top-0 right-0 h-125 w-125 rounded-full bg-[#124AB9]/8 blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-100 w-100 rounded-full bg-[#124AB9]/5 blur-[80px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-50 w-full border-b border-[#124AB9]/10 bg-white/80 px-6 py-2 backdrop-blur-md lg:px-12">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="DastavejSetu Logo"
              className="h-12 w-12 object-contain"
            />
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              DastavejSetu
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#124AB9]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Signup Form */}
      <main className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold text-slate-900">
              Create an account
            </CardTitle>
            <CardDescription className="text-slate-600">
              Get started with your free account today
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Signup Form */}
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 border-slate-200 bg-white! pl-10 text-slate-900 placeholder:text-slate-400 hover:border-[#124AB9] focus-visible:border-2 focus-visible:!border-[#124AB9] focus-visible:!ring-0"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 border-slate-200 bg-white! pl-10 text-slate-900 placeholder:text-slate-400 hover:border-[#124AB9] focus-visible:border-2 focus-visible:!border-[#124AB9] focus-visible:!ring-0"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="h-11 w-full bg-[#124AB9] font-medium text-white transition-all hover:bg-[#0d3a94] hover:shadow-lg hover:shadow-[#124AB9]/25"
                disabled={isLoading}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            {/* Login link */}
            <div className="text-center text-sm">
              <span className="text-slate-600">Already have an account? </span>
              <Link
                href="/login"
                className="font-semibold text-[#124AB9] transition-colors hover:underline"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
