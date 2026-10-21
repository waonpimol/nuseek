import { useEffect, useState, type CSSProperties } from 'react';
import { LOCATIONS } from '../utils/locations';

export interface EditPostValues {
	title: string;
	description: string;
	location: string;
}

interface EditPostModalProps {
	open: boolean;
	initial: EditPostValues;
	saving: boolean;
	error: string | null;
	onSave: (values: EditPostValues) => void;
	onCancel: () => void;
}

// modal แก้ไขโพสต์ของตัวเอง (ชื่อ/รายละเอียด/สถานที่) — รูปแก้ไม่ได้ ถ้าผิดให้ลบแล้วลงใหม่
export default function EditPostModal({ open, initial, saving, error, onSave, onCancel }: EditPostModalProps) {
	const [title, setTitle] = useState(initial.title);
	const [description, setDescription] = useState(initial.description);
	const [location, setLocation] = useState(initial.location);

	// เปิด modal ครั้งใหม่ทุกครั้ง ให้เริ่มจากค่าปัจจุบันของโพสต์ (ไม่ค้างค่าที่พิมพ์แล้วกดยกเลิกไป)
	useEffect(() => {
		if (open) {
			setTitle(initial.title);
			setDescription(initial.description);
			setLocation(initial.location);
		}
	}, [open, initial.title, initial.description, initial.location]);

	if (!open) return null;

	const canSave = title.trim().length > 0 && !saving;

	return (
		<div style={styles.overlay}>
			<div style={styles.card}>
				<h2 style={styles.heading}>แก้ไขประกาศ</h2>

				<label style={styles.label}>ชื่อสิ่งของ</label>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="เช่น โทรศัพท์มือถือ Samsung สีดำ"
					style={styles.input}
				/>

				<label style={styles.label}>รายละเอียด</label>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="ลักษณะ ยี่ห้อ สี ตำหนิ ฯลฯ"
					rows={5}
					style={{ ...styles.input, resize: 'vertical' }}
				/>

				<label style={styles.label}>สถานที่</label>
				<input
					type="text"
					list="edit-location-suggestions"
					value={location}
					onChange={(e) => setLocation(e.target.value)}
					style={styles.input}
				/>
				<datalist id="edit-location-suggestions">
					{LOCATIONS.map((loc) => (
						<option key={loc.value} value={loc.value} />
					))}
				</datalist>

				<p style={styles.hint}>แก้ไขรูปไม่ได้ ถ้ารูปผิดให้ลบประกาศแล้วลงใหม่</p>
				{error && <p style={styles.error}>{error}</p>}

				<div style={styles.actions}>
					<button type="button" onClick={onCancel} disabled={saving} style={styles.cancelBtn}>
						ยกเลิก
					</button>
					<button
						type="button"
						onClick={() => onSave({ title, description, location })}
						disabled={!canSave}
						style={{ ...styles.saveBtn, opacity: canSave ? 1 : 0.5 }}
					>
						{saving ? 'กำลังบันทึก...' : 'บันทึก'}
					</button>
				</div>
			</div>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	overlay: {
		position: 'fixed',
		inset: 0,
		backgroundColor: 'rgba(26, 32, 44, 0.5)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1000,
		padding: '16px',
	},
	card: {
		backgroundColor: '#FFFFFF',
		borderRadius: '24px',
		padding: '24px 22px',
		maxWidth: '460px',
		width: '100%',
		maxHeight: '90vh',
		overflowY: 'auto',
		boxSizing: 'border-box',
		display: 'flex',
		flexDirection: 'column',
		gap: '6px',
		boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
	},
	heading: { margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#1A202C' },
	label: { fontSize: '13px', fontWeight: 600, color: '#4A5568', marginTop: '6px' },
	input: {
		width: '100%',
		boxSizing: 'border-box',
		padding: '10px 12px',
		borderRadius: '12px',
		border: '1px solid #E2E8F0',
		backgroundColor: '#F7FAFC',
		fontSize: '14px',
		fontFamily: 'inherit',
		color: '#1A202C',
	},
	hint: { margin: '6px 0 0', fontSize: '12px', color: '#718096' },
	error: { margin: '4px 0 0', fontSize: '13px', color: '#DC2626' },
	actions: { display: 'flex', gap: '10px', marginTop: '14px' },
	cancelBtn: {
		flex: 1,
		padding: '11px',
		borderRadius: '12px',
		border: '1px solid #E2E8F0',
		backgroundColor: '#FFFFFF',
		color: '#4A5568',
		fontSize: '14px',
		fontWeight: 600,
		cursor: 'pointer',
		fontFamily: 'inherit',
	},
	saveBtn: {
		flex: 1,
		padding: '11px',
		borderRadius: '12px',
		border: 'none',
		backgroundColor: '#EA580C',
		color: '#FFFFFF',
		fontSize: '14px',
		fontWeight: 600,
		cursor: 'pointer',
		fontFamily: 'inherit',
	},
};