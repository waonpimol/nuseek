import { Link } from "react-router-dom";
import { PackageSearch } from "lucide-react";

export default function Logo() {
	return (
		<Link to="/" aria-label="NUSeek หน้าแรก" className="flex items-center gap-2 md:gap-2.5 select-none">
			<span className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
				<PackageSearch className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2} />
			</span>
			<span className="text-2xl md:text-3xl font-extrabold tracking-tight leading-none">
				<span className="text-gray-900">NU</span>
				<span className="text-orange-500">Seek</span>
			</span>
		</Link>
	);
}
