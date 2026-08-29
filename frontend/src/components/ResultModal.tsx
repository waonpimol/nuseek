import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ResultModalProps {
	open: boolean;
	success: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	onConfirm: () => void;
}

// แปลง **ข้อความ** จาก markdown อย่างง่าย ให้กลายเป็น <strong> จริง
// (ข้อความมาจาก agent ของเราเอง เชื่อถือได้ ไม่ต้อง sanitize มาก)
function renderWithBold(text: string) {
	const parts = text.split(/(\*\*[^*]+\*\*)/g);
	return parts.map((part, i) => {
		if (part.startsWith('**') && part.endsWith('**')) {
			return <strong key={i}>{part.slice(2, -2)}</strong>;
		}
		return <React.Fragment key={i}>{part}</React.Fragment>;
	});
}

export default function ResultModal({
	open,
	success,
	title,
	message,
	confirmLabel = 'ตกลง',
	onConfirm,
}: ResultModalProps) {
	if (!open) return null;

	return (
		<div style={styles.overlay}>
			<div style={styles.card}>
				<div style={{ ...styles.iconWrap, backgroundColor: success ? '#F0FDF4' : '#FEF2F2' }}>
					{success ? (
						<CheckCircle2 size={32} color="#16A34A" />
					) : (
						<XCircle size={32} color="#DC2626" />
					)}
				</div>

				<h2 style={styles.title}>{title}</h2>

				<p style={styles.message}>{renderWithBold(message)}</p>

				<button onClick={onConfirm} style={styles.confirmBtn}>
					{confirmLabel}
				</button>
			</div>
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
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
		padding: '32px 28px',
		maxWidth: '420px',
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		textAlign: 'center',
		boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
	},
	iconWrap: {
		width: '64px',
		height: '64px',
		borderRadius: '50%',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: '16px',
	},
	title: {
		fontSize: '18px',
		fontWeight: 'bold',
		color: '#1A202C',
		margin: '0 0 10px 0',
	},
	message: {
		fontSize: '14px',
		color: '#4A5568',
		lineHeight: '1.7',
		margin: '0 0 24px 0',
		whiteSpace: 'pre-line',
	},
	confirmBtn: {
		width: '100%',
		backgroundColor: '#ED8936',
		color: '#FFFFFF',
		border: 'none',
		padding: '12px 0',
		borderRadius: '12px',
		fontSize: '14px',
		fontWeight: '600',
		cursor: 'pointer',
		fontFamily: 'inherit',
	},
};
