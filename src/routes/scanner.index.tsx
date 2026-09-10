import { createFileRoute } from "@tanstack/react-router";
import { ScanPage } from "@/components/scanner/ScanPage";

export const Route = createFileRoute("/scanner/")({ component: ScanPage });
