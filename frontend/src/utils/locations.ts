export interface LocationOption {
	value: string;
	label: string;
	keywords: string[];
}

export const LOCATIONS: LocationOption[] = [
	{ value: "ลานสมเด็จ", label: "ลานสมเด็จ", keywords: ["ลานสมเด็จ"] },
	{ value: "คณะวิศวกรรมศาสตร์", label: "คณะวิศวกรรมศาสตร์", keywords: ["วิศว"] },
	{ value: "คณะวิทยาศาสตร์", label: "คณะวิทยาศาสตร์", keywords: ["วิทยาศาสตร์"] },
	{ value: "คณะแพทยศาสตร์", label: "คณะแพทยศาสตร์", keywords: ["แพทยศาสตร์", "โรงพยาบาล"] },
	{ value: "คณะพยาบาลศาสตร์", label: "คณะพยาบาลศาสตร์", keywords: ["พยาบาล"] },
	{ value: "คณะทันตแพทยศาสตร์", label: "คณะทันตแพทยศาสตร์", keywords: ["ทันตแพทย", "ทันตกรรม"] },
	{ value: "คณะเภสัชศาสตร์", label: "คณะเภสัชศาสตร์", keywords: ["เภสัช"] },
	{ value: "คณะสาธารณสุขศาสตร์", label: "คณะสาธารณสุขศาสตร์", keywords: ["สาธารณสุข"] },
	{ value: "คณะสหเวชศาสตร์", label: "คณะสหเวชศาสตร์", keywords: ["สหเวช"] },
	{ value: "คณะเกษตรศาสตร์ ทรัพยากรธรรมชาติและสิ่งแวดล้อม", label: "คณะเกษตรศาสตร์ฯ", keywords: ["เกษตร"] },
	{ value: "คณะบริหารธุรกิจ เศรษฐศาสตร์และการสื่อสาร", label: "คณะบริหารธุรกิจฯ", keywords: ["บริหารธุรกิจ", "เศรษฐศาสตร์"] },
	{ value: "คณะนิติศาสตร์", label: "คณะนิติศาสตร์", keywords: ["นิติ"] },
	{ value: "คณะศึกษาศาสตร์", label: "คณะศึกษาศาสตร์", keywords: ["ศึกษาศาสตร์"] },
	{ value: "คณะมนุษยศาสตร์", label: "คณะมนุษยศาสตร์", keywords: ["มนุษยศาสตร์"] },
	{ value: "คณะสังคมศาสตร์", label: "คณะสังคมศาสตร์", keywords: ["สังคมศาสตร์"] },
	{ value: "คณะสถาปัตยกรรมศาสตร์ ศิลปะและการออกแบบ", label: "คณะสถาปัตยกรรมศาสตร์ฯ", keywords: ["สถาปัตย"] },
	{ value: "คณะโลจิสติกส์และดิจิทัลซัพพลายเชน", label: "คณะโลจิสติกส์ฯ", keywords: ["โลจิสติกส์"] },
	{ value: "หอสมุด", label: "หอสมุด", keywords: ["หอสมุด", "ห้องสมุด"] },
	{ value: "หอพักนิสิต", label: "หอพักนิสิต", keywords: ["หอพัก"] },
	{ value: "โรงอาหาร", label: "โรงอาหาร", keywords: ["โรงอาหาร", "canteen"] },
	{ value: "สนามกีฬา", label: "สนามกีฬา", keywords: ["สนามกีฬา", "สนาม"] },
	{ value: "สระหอใน", label: "สระหอใน", keywords: ["สระหอใน"] },
	{ value: "NU Playground", label: "NU Playground", keywords: ["NU Playground"] },
	{ value: "สระแมว", label: "สระแมว", keywords: ["สระแมว"] },
	{ value: "อื่นๆ", label: "อื่นๆ", keywords: [] },
];