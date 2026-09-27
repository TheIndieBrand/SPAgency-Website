// any link to another site opens in a new tab, including ones rendered
// after load (chat, dashboard cards). marked on click, right before the
// browser navigates, so no template needs touching. links with
// `data-same-tab` are left as they are.
document.addEventListener(
	"click",
	(event) => {
		const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
		if (!link || link.target || link.hasAttribute("data-same-tab") || link.hasAttribute("download")) return;
		if (!/^https?:$/.test(link.protocol) || link.origin === window.location.origin) return;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
	},
	true,
);
