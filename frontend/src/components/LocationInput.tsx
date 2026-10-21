import { useState } from 'react';
import type { CSSProperties } from 'react';
import { LOCATIONS } from '../utils/locations';

interface Props {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	required?: boolean;
	inputStyle?: CSSProperties;
	wrapperStyle?: CSSProperties;
}

// ช่องสถานที่ + รายการแนะนำ (ใช้แทน <datalist> ซึ่งบนมือถือบางรุ่น/บางเบราว์เซอร์ทำให้พิมพ์ในช่องไม่ได้)
export default function LocationInput({ value, onChange, placeholder, required, inputStyle, wrapperStyle }: Props) {
	const [open, setOpen] = useState(false);

	const q = value.trim().toLowerCase();
	const suggestions = LOCATIONS.filter(
		(loc) =>
			!q ||
			loc.value.toLowerCase().includes(q) ||
			loc.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase())),
	).filter((loc) => loc.value !== value);

	return (
		<div style={{ position: 'relative', ...wrapperStyle }}>
			<input
				type="text"
				autoComplete="off"
				placeholder={placeholder}
				value={value}
				required={required}
				onChange={(e) => {
					onChange(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				style={inputStyle}
			/>
			{open && suggestions.length > 0 && (
				<ul style={styles.list}>
					{suggestions.map((loc) => (
						<li
							key={loc.value}
							// ใช้ onMouseDown + preventDefault เพื่อให้เลือกได้ก่อนช่องพิมพ์เสีย focus แล้วรายการปิด
							onMouseDown={(e) => {
								e.preventDefault();
								onChange(loc.value);
								setOpen(false);
							}}
							style={styles.item}
						>
							{loc.value}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	list: {
		position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
		maxHeight: '220px', overflowY: 'auto', margin: 0, padding: '4px 0', listStyle: 'none',
		backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px',
		boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
	},
	item: { padding: '10px 14px', fontSize: '14px', color: '#4A5568', cursor: 'pointer' },
};
