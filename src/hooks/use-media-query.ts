import { useEffect, useState } from "react";

export default function useMediaQuery(query: string): boolean {
	const getMatches = (q: string): boolean => {
		if (typeof window === "undefined") return false;
		return window.matchMedia(q).matches;
	};

	const [matches, setMatches] = useState<boolean>(getMatches(query));

	useEffect(() => {
		const mediaQueryList = window.matchMedia(query);
		const onChange = () => setMatches(mediaQueryList.matches);
		onChange();
		mediaQueryList.addEventListener("change", onChange);
		return () => mediaQueryList.removeEventListener("change", onChange);
	}, [query]);

	return matches;
}
