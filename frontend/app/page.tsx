'use client';

import {
  ArrowRight,
  Brain,
  Check,
  Download,
  Heart,
  Upload,
} from 'lucide-react';
import Link from 'next/link';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      data-theme="light"
      className="relative min-h-screen overflow-hidden bg-white"
    >
      {/* Subtle Blue Gradient Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-linear-to-br from-white via-[#124AB9]/3 to-[#124AB9]/5" />
        <div
          className={`absolute top-0 right-0 h-125 w-125 rounded-full bg-[#124AB9]/8 blur-[100px] transition-all duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={`absolute bottom-0 left-0 h-100 w-100 rounded-full bg-[#124AB9]/5 blur-[80px] transition-all delay-300 duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        />
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

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-sm font-medium text-slate-600 transition-colors hover:text-[#124AB9]"
              >
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="group bg-[#124AB9] px-5 text-sm font-medium text-white transition-all hover:bg-[#0d3a94] hover:shadow-lg hover:shadow-[#124AB9]/20"
              >
                <span className="relative z-10">Get Started</span>
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="flex flex-col items-center px-6 pt-24 pb-32 lg:px-12">
          {/* Eyebrow */}
          <div
            className={`mb-8 flex items-center gap-2 transition-all duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            <div className="h-px w-8 bg-linear-to-r from-transparent to-[#124AB9]" />
            <span className="text-xs font-semibold tracking-[0.2em] text-[#124AB9] uppercase">
              Document Intelligence
            </span>
            <div className="h-px w-8 bg-linear-to-l from-transparent to-[#124AB9]" />
          </div>

          {/* Title */}
          <h1
            className={`max-w-4xl text-center text-4xl leading-[1.2] font-semibold tracking-tight text-slate-900 transition-all delay-100 duration-700 sm:text-5xl md:text-6xl ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            Transform Documents into
            <span className="mt-3 block text-[#124AB9]">Digital Data</span>
          </h1>

          {/* Description */}
          <p
            className={`mx-auto mt-8 max-w-xl text-center text-base leading-relaxed text-slate-600 transition-all delay-200 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            Advanced OCR technology that converts photos, PDFs, and scanned
            documents into structured Excel formats with precision.
          </p>

          {/* CTA */}
          <div
            className={`mt-10 transition-all delay-300 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            <Link href="/signup">
              <Button
                size="lg"
                className="group h-12 bg-[#124AB9] px-8 text-sm font-medium text-white transition-all hover:bg-[#0d3a94] hover:shadow-lg hover:shadow-[#124AB9]/25"
              >
                Start Converting
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div
            className={`mt-16 flex flex-wrap items-center justify-center gap-6 text-slate-500 transition-all delay-500 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            {['99.9% Accuracy', 'Enterprise Security', '50K+ Documents'].map(
              (item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Check className="h-4 w-4 text-[#124AB9]" />
                  <span className="font-medium">{item}</span>
                </div>
              ),
            )}
          </div>

          {/* Process Section */}
          <div
            className={`mt-32 w-full max-w-6xl transition-all delay-500 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            {/* Section Header */}
            <div className="mb-16 text-center">
              <h2 className="text-2xl font-semibold text-slate-900">
                How it <span className="text-[#124AB9]">works</span>
              </h2>
            </div>

            {/* Steps */}
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: '01',
                  icon: Upload,
                  title: 'Upload',
                  description:
                    'Drag and drop your documents. We support PDF, PNG, JPG, and TIFF formats.',
                },
                {
                  step: '02',
                  icon: Brain,
                  title: 'Process',
                  description:
                    'Our AI engine extracts text and structures your data with machine learning precision.',
                },
                {
                  step: '03',
                  icon: Download,
                  title: 'Export',
                  description:
                    'Download your data in Excel, CSV, or JSON format. Ready to use instantly.',
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="group relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-[#124AB9] hover:shadow-2xl hover:shadow-[#124AB9]/10"
                >
                  {/* Gradient Background Overlay on Hover */}
                  <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-[#124AB9]/3 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  {/* Step Number - Top Right Corner */}
                  <div className="absolute -top-3 -right-3 z-10">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#124AB9] text-xs font-bold text-white shadow-md transition-all duration-500 group-hover:scale-110 group-hover:bg-[#0d3a94]">
                      {item.step}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className="relative z-10 mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#124AB9]/8 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#124AB9]">
                    <item.icon
                      className="h-5 w-5 text-[#124AB9] transition-colors duration-500 group-hover:text-white"
                      strokeWidth={2}
                    />
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    <h3 className="mb-3 text-lg font-semibold text-slate-900 transition-colors duration-500 group-hover:text-[#124AB9]">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>

                  {/* Corner Accent */}
                  <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-[#124AB9]/5 opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#124AB9]/10 bg-slate-50/50">
        <div className="container flex h-16 items-center justify-between px-6 lg:px-12">
          <p className="text-xs text-slate-500">
            © 2026 Udayam AI Labs. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            Made with
            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
            by{' '}
            <a
              href="https://udayam.co.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#124AB9] transition-colors hover:underline"
            >
              Udayam AI Labs
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
