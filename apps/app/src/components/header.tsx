import { UserMenu } from "@/components/user-menu";
import { getOnboardingForCurrentOrganization } from "@/data/getOnboarding";
import { getI18n } from "@/locales/server";
import { auth } from "@/utils/auth";
import { buttonVariants } from "@comp/ui/button"
import { Button } from "@comp/ui/button";
import { Icons } from "@comp/ui/icons";
import { Skeleton } from "@comp/ui/skeleton";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AssistantButton } from "./ai/chat-button";
import { MobileMenu } from "./mobile-menu";
import { NotificationCenter } from "./notification-center";

export async function Header() {
	const t = await getI18n();

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const currentOrganizationId = session?.session.activeOrganizationId;

	if (!currentOrganizationId) {
		redirect("/");
	}

	const { completedAll } = await getOnboardingForCurrentOrganization();

	return (
		<header className="-ml-4 -mr-4 md:m-0 z-10 px-4 md:px-0 md:border-b-[1px] flex justify-between pt-4 pb-2 md:pb-4 items-center todesktop:sticky todesktop:top-0 todesktop:bg-background todesktop:border-none sticky md:static top-0 backdrop-filter backdrop-blur-xl md:backdrop-filter md:backdrop-blur-none bg-opacity-70">
			<MobileMenu organizationId={currentOrganizationId} completedOnboarding={completedAll} />

			<AssistantButton />

			<div className="flex space-x-2 ml-auto">
				<div className="hidden md:flex gap-2">
					<Link className={buttonVariants({ variant: "outline", className: "rounded-full font-normal h-[32px] p-0 px-3 text-xs text-muted-foreground gap-2 items-center" })} href="https://roadmap.trycomp.ai" target="_blank">Feedback</Link>
					<Link className={buttonVariants({ variant: "outline", className: "rounded-full font-normal h-[32px] p-0 px-3 text-xs text-muted-foreground gap-2 items-center" })} href="https://discord.gg/compai" target="_blank">
						<Icons.Discord className="h-4 w-4" />
						{t("header.discord.button")}
					</Link>
				</div>

				<NotificationCenter />

				<Suspense
					fallback={<Skeleton className="h-8 w-8 rounded-full" />}
				>
					<UserMenu />
				</Suspense>
			</div>
		</header>
	);
}
