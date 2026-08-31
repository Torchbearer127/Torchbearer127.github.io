import type { LocalizedString } from '../i18n/content.ts';

const text = (en: string, zhCN: string, de: string): LocalizedString => ({
	en,
	'zh-CN': zhCN,
	de,
});

export const homeSections = [
	{
		id: 'current-work',
		title: text('Current Work', '当前工作', 'Aktuelle Arbeit'),
		emptyTitle: text(
			'The public work overview is taking shape.',
			'公开工作概览正在逐步成形。',
			'Der öffentliche Arbeitsüberblick nimmt Gestalt an.',
		),
		emptyDescription: text(
			'Current focus, selected work, and publications will appear here as they are ready.',
			'当前方向、精选工作与发表成果将在准备好后出现在这里。',
			'Aktuelle Schwerpunkte, ausgewählte Arbeiten und Publikationen erscheinen hier, sobald sie bereit sind.',
		),
		href: '/work',
		linkLabel: text('Explore Work', '浏览工作', 'Arbeit entdecken'),
		fieldVariant: 'section-right' as const,
		fieldSeed: 211,
	},
	{
		id: 'latest-writing',
		title: text('Latest Writing', '最新写作', 'Neueste Texte'),
		emptyTitle: text('No writing published yet.', '尚未发布文章。', 'Noch keine Texte veröffentlicht.'),
		emptyDescription: text(
			'Research notes, technical writing, and essays will appear here when they are ready.',
			'研究笔记、技术写作与随笔将在准备好后出现在这里。',
			'Forschungsnotizen, technische Texte und Essays erscheinen hier, sobald sie bereit sind.',
		),
		href: '/writing',
		linkLabel: text('Browse Writing', '浏览写作', 'Texte ansehen'),
		fieldVariant: 'section-left' as const,
		fieldSeed: 337,
	},
];

export const workContent = {
	eyebrow: text('Research & engineering', '研究与工程', 'Forschung & Engineering'),
	title: text('Work', '工作', 'Arbeit'),
	description: text(
		'Current directions, selected work, and publications across agent systems and cyberspace security.',
		'围绕智能体系统与网络空间安全的当前方向、精选工作与发表成果。',
		'Aktuelle Richtungen, ausgewählte Arbeiten und Publikationen zu Agentensystemen und Cyberspace-Sicherheit.',
	),
	sections: [
		{
			id: 'current-focus',
			title: text('Current Focus', '当前方向', 'Aktueller Fokus'),
			description: text(
				'A concise view of active research directions will appear here as they become ready to share.',
				'正在推进的研究方向将在适合公开时以简洁方式呈现在这里。',
				'Ein kompakter Überblick über aktive Forschungsrichtungen erscheint hier, sobald er geteilt werden kann.',
			),
		},
		{
			id: 'selected-work',
			title: text('Selected Work', '精选工作', 'Ausgewählte Arbeiten'),
			description: text(
				'Selected research, engineering work, tools, and reproductions will be documented here.',
				'精选研究、工程工作、工具与复现记录将在这里整理。',
				'Ausgewählte Forschung, Engineering-Arbeiten, Werkzeuge und Reproduktionen werden hier dokumentiert.',
			),
		},
		{
			id: 'publications',
			title: text('Publications', '发表成果', 'Publikationen'),
			description: text(
				'Publications will be listed here with links to papers, code, and artifacts where available.',
				'发表成果将在这里列出，并在可用时附上论文、代码与制品链接。',
				'Publikationen werden hier mit Links zu Papern, Code und Artefakten aufgeführt, soweit verfügbar.',
			),
		},
	],
};

export const aboutContent = {
	eyebrow: text('Identity', '身份', 'Identität'),
	title: text('About', '关于', 'Über mich'),
	description: text(
		'A brief orientation to my work across agent systems and cyberspace security.',
		'关于我在智能体系统与网络空间安全方向工作的简要说明。',
		'Eine kurze Einordnung meiner Arbeit an Agentensystemen und Cyberspace-Sicherheit.',
	),
	researchTitle: text('Research Interests', '研究兴趣', 'Forschungsinteressen'),
	researchIntro: text(
		'Agent systems and cyberspace security are the two primary axes of my work. AI4Sec and agent security are where these directions intersect.',
		'智能体系统与网络空间安全是我工作的两条主轴，AI4Sec 与智能体安全是二者的交汇处。',
		'Agentensysteme und Cyberspace-Sicherheit bilden die beiden Hauptachsen meiner Arbeit. AI4Sec und Agentensicherheit liegen an ihrer Schnittstelle.',
	),
	focusAreas: [
		{
			id: 'agent-systems',
			title: text('Agent Systems & Engineering', '智能体系统与工程', 'Agentensysteme & Engineering'),
			items: [
				text('Agent Harnesses', 'Agent Harnesses', 'Agent Harnesses'),
				text('Tool Use and Orchestration', '工具使用与编排', 'Werkzeugnutzung und Orchestrierung'),
				text('Context and Evaluation', '上下文与评估', 'Kontext und Evaluation'),
				text('Reliable Agent Workflows', '可靠的智能体工作流', 'Zuverlässige Agenten-Workflows'),
			],
		},
		{
			id: 'software-security',
			title: text('Software Security', '软件安全', 'Softwaresicherheit'),
			items: [
				text('Vulnerability Discovery', '漏洞发现', 'Schwachstellenentdeckung'),
				text('Program Analysis', '程序分析', 'Programmanalyse'),
				text('Exploitability Validation', '可利用性验证', 'Validierung der Ausnutzbarkeit'),
			],
		},
		{
			id: 'ai4sec',
			title: text('AI4Sec & Agent Security — The Intersection', 'AI4Sec 与智能体安全——交汇点', 'AI4Sec & Agentensicherheit — die Schnittstelle'),
			items: [
				text('Agent Security', '智能体安全', 'Agentensicherheit'),
				text('AI-assisted Program Analysis', 'AI 辅助程序分析', 'KI-gestützte Programmanalyse'),
				text('Automated Vulnerability Reasoning', '自动化漏洞推理', 'Automatisierte Schwachstellenanalyse'),
				text('Closed-loop Validation', '闭环验证', 'Geschlossene Validierungsschleifen'),
			],
		},
	],
	pathsTitle: text('Forking Paths', '岔路', 'Abzweigende Pfade'),
	pathsIntro: text(
		'Forking paths of curiosity—from auxiliary crafts to written thoughts and the open snow.',
		'好奇心伸出的岔路——从辅助技艺、文字思考到开阔雪地。',
		'Abzweigende Pfade der Neugier — von ergänzenden Fertigkeiten und geschriebenen Gedanken bis zum offenen Schnee.',
	),
	paths: [
		text('Penetration Testing', '渗透测试', 'Penetrationstests'),
		text('Algorithms & Data Structures', '算法与数据结构', 'Algorithmen & Datenstrukturen'),
		text('Thoughts on Philosophy and Mind', '关于哲学与心智的思考', 'Gedanken über Philosophie und Geist'),
		text('Essays, Prose, and Creative Writing', '随笔、散文与创意写作', 'Essays, Prosa und kreatives Schreiben'),
		text('Snowboarding & Fitness', '单板滑雪与健身', 'Snowboarden & Fitness'),
	],
	galleryTitle: text('Gallery', '影集', 'Galerie'),
	galleryExplore: text('Explore Gallery', '浏览影集', 'Galerie ansehen'),
	galleryDescription: text('A curated collection of personal moments.', '经过挑选的个人时刻。', 'Eine kuratierte Sammlung persönlicher Momente.'),
	hallTitle: text('Hall of Fame', '荣誉墙', 'Hall of Fame'),
	hallExplore: text('View Hall', '查看荣誉墙', 'Hall ansehen'),
	hallDescription: text('Selected milestones worth keeping on the wall.', '值得留在墙上的精选里程碑。', 'Ausgewählte Meilensteine, die einen Platz an der Wand verdienen.'),
	elsewhere: text('Elsewhere', '其他站点', 'Anderswo'),
};

export const collectionContent = {
	gallery: {
		eyebrow: text('Curated moments', '精选时刻', 'Kuratierte Momente'),
		title: text('Gallery', '影集', 'Galerie'),
		description: text('A modest, curated collection of personal moments and places.', '一组克制挑选的个人时刻与地点。', 'Eine kleine, kuratierte Sammlung persönlicher Momente und Orte.'),
		empty: text('The gallery is waiting for its first selected image.', '影集正在等待第一张入选的照片。', 'Die Galerie wartet auf ihr erstes ausgewähltes Bild.'),
	},
	hall: {
		eyebrow: text('Milestones & recognition', '里程碑与认可', 'Meilensteine & Anerkennung'),
		title: text('Hall of Fame', '荣誉墙', 'Hall of Fame'),
		description: text('Selected milestones and recognitions worth keeping on the wall.', '值得留在墙上的精选里程碑与认可。', 'Ausgewählte Meilensteine und Anerkennungen, die einen Platz an der Wand verdienen.'),
		empty: text('No milestones have been published here yet.', '这里尚未发布里程碑。', 'Hier wurden noch keine Meilensteine veröffentlicht.'),
	},
};
