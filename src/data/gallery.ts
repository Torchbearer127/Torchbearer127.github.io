import type { LocalizedString } from '../i18n/content';

export interface GalleryItem {
	id: string;
	src: string;
	alt: LocalizedString;
	caption: LocalizedString;
	width?: number;
	height?: number;
	aboutPreview?: 1 | 2 | 3;
	previewPosition?: { x: number; y: number };
	date?: string;
	location?: LocalizedString;
}

// Add selected personal images under public/gallery and reference /gallery/… here.
// Assign aboutPreview explicitly; archive order does not select teaser images.
export const galleryItems: GalleryItem[] = [
	{
		id: 'hefei-cyberspace-security-2026',
		src: '/gallery/hefei-cyberspace-security-2026.jpg',
		width: 4096,
		height: 3072,
		aboutPreview: 1,
		previewPosition: { x: 50, y: 50 },
		alt: {
			'zh-CN': '夜色中的湖畔楼宇亮起红色灯光，楼身显示“中国网络空间安全大会”，灯光倒映在水面上。',
			en: 'Red-lit buildings beside a lake at night, with Chinese text announcing the cyberspace security conference and lights reflected on the water.',
			de: 'Rot beleuchtete Gebäude an einem See bei Nacht, mit chinesischem Schriftzug zur Cybersicherheitskonferenz und Lichtreflexen auf dem Wasser.',
		},
		caption: {
			'zh-CN': '2026 · 合肥 | 中国网络空间安全大会',
			en: '2026 · Hefei | China Cyberspace Security Conference',
			de: '2026 · Hefei | Chinesische Konferenz für Cybersicherheit',
		},
	},
	{
		id: 'chengdu-cncc-2026',
		src: '/gallery/chengdu-cncc-2026.jpg',
		width: 4096,
		height: 3072,
		aboutPreview: 3,
		alt: {
			'zh-CN': '大会会场内坐满观众，蓝色大屏幕展示讨论议题与发言嘉宾的画面。',
			en: 'An audience seated in a conference hall, with blue screens showing a discussion topic and a speaker.',
			de: 'Ein Publikum sitzt in einem Konferenzsaal; blaue Bildschirme zeigen ein Diskussionsthema und einen Redner.',
		},
		caption: {
			'zh-CN': '2026 · 成都 | 中国计算机大会',
			en: '2026 · Chengdu | China National Computer Congress',
			de: '2026 · Chengdu | Chinesischer Nationaler Computerkongress',
		},
	},
	{
		id: 'chengdu-yulin-road',
		src: '/gallery/chengdu-yulin-road.jpg',
		width: 3072,
		height: 4096,
		aboutPreview: 2,
		alt: {
			'zh-CN': '临街木桌上放着一杯带盖的花茶和两枚角色徽章，背景是虚化的行人、店铺与街道。',
			en: 'A lidded glass cup of flower tea and two character badges on a wooden table, with pedestrians, shops, and a street softly blurred behind them.',
			de: 'Eine Glastasse mit Deckel und Blütentee sowie zwei Figuren-Anstecker auf einem Holztisch; dahinter unscharfe Passanten, Geschäfte und eine Straße.',
		},
		caption: {
			'zh-CN': '成都 · 玉林路 | 故梦抵蓉，新程未央',
			en: 'Chengdu · Yulin Road | Old dreams alight in the Hibiscus City; a boundless new journey unfolds.',
			de: 'Chengdu · Yulin-Straße | Alte Träume finden Rast in der Stadt der Hibiskusblüten; ein neuer, unendlicher Weg entfaltet sich.',
		},
	},
];
