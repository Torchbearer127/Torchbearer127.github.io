import type { LocalizedString } from '../i18n/content.ts';

const text = (en: string, zhCN: string, de: string): LocalizedString => ({
	en,
	'zh-CN': zhCN,
	de,
});

export const homeSections = [
	{
		id: 'current-work',
		title: text('Current Work', '近期进展', 'Aktuelle Arbeit'),
		emptyTitle: text(
			'The public work overview is taking shape.',
			'公开研究与工程概览正在构筑中。',
			'Der öffentliche Arbeitsüberblick nimmt Gestalt an.',
		),
		emptyDescription: text(
			'Current focus, selected work, and publications will appear here as they are ready.',
			'近期课题、开源项目与学术产出整理就绪后，将在此呈现。',
			'Aktuelle Schwerpunkte, ausgewählte Arbeiten und Publikationen erscheinen hier, sobald sie bereit sind.',
		),
		href: '/work',
		linkLabel: text('Explore Work', '检视研究与实践', 'Arbeit entdecken'),
		fieldVariant: 'section-right' as const,
		fieldSeed: 211,
	},
	{
		id: 'latest-writing',
		title: text('Latest Writing', '近期文字', 'Neueste Texte'),
		emptyTitle: text('No writing published yet.', '暂无新近发布的文稿。', 'Noch keine Texte veröffentlicht.'),
		emptyDescription: text(
			'Research notes, technical writing, and essays will appear here when they are ready.',
			'研究札记、技术实践与沉思长文将在此持续归档。',
			'Forschungsnotizen, technische Texte und Essays erscheinen hier, sobald sie bereit sind.',
		),
		href: '/writing',
		linkLabel: text('Browse Writing', '浏览所有文字', 'Texte ansehen'),
		fieldVariant: 'section-left' as const,
		fieldSeed: 337,
	},
];

export const workContent = {
	eyebrow: text('Research & engineering', '学术研究与工程实践', 'Forschung & Engineering'),
	title: text('Work', '研究与实践', 'Arbeit'),
	description: text(
		'Current directions, selected work, and publications across agent systems and cyberspace security.',
		'围绕智能体系统与网络空间安全展开的当前课题、精选工程与学术发表。',
		'Aktuelle Richtungen, ausgewählte Arbeiten und Publikationen zu Agentensystemen und Cyberspace-Sicherheit.',
	),
	sections: [
		{
			id: 'current-focus',
			title: text('Current Focus', '当前聚焦', 'Aktueller Fokus'),
			description: text(
				'A concise view of active research directions will appear here as they become ready to share.',
				'正在推进的研究课题与系统构建，将在适当时机提炼呈现。',
				'Ein kompakter Überblick über aktive Forschungsrichtungen erscheint hier, sobald er geteilt werden kann.',
			),
		},
		{
			id: 'selected-work',
			title: text('Selected Work', '精选项目与系统', 'Ausgewählte Arbeiten'),
			description: text(
				'Selected research, engineering work, tools, and reproductions will be documented here.',
				'精选学术探索、自研安全工具、智能体系统与 SOTA 复现沉淀。',
				'Ausgewählte Forschung, Engineering-Arbeiten, Werkzeuge und Reproduktionen werden hier dokumentiert.',
			),
		},
		{
			id: 'publications',
			title: text('Publications', '学术发表', 'Publikationen'),
			description: text(
				'Publications will be listed here with links to papers, code, and artifacts where available.',
				'学术成果汇总，并附论文预印本、开源代码与复现产物索引。',
				'Publikationen werden hier mit Links zu Papern, Code und Artefakten aufgeführt, soweit verfügbar.',
			),
		},
	],
};

export const aboutContent = {
	eyebrow: text('Identity', '个人概览', 'Identität'),
	title: text('About', '关于', 'Über mich'),
	description: text(
		'A brief orientation to my work across agent systems and cyberspace security.',
		'我在智能体系统、网络安全及二者交叉领域的探索脉络与心智图谱。',
		'Eine kurze Einordnung meiner Arbeit an Agentensystemen und Cyberspace-Sicherheit.',
	),
	researchTitle: text('Research Interests', '核心研究领域', 'Forschungsinteressen'),
	researchIntro: text(
		'Agent systems and cyberspace security are the two primary axes of my work. AI4Sec (AI for Security) and agent security are where these directions intersect.',
		'智能体系统（Agent Systems）与网络空间安全（Cyberspace Security）构成我的两条研究主轴，而 AI4Sec (AI for Security) 与智能体安全即为二者的交叉领域。',
		'Agentensysteme und Cyberspace-Sicherheit bilden die beiden Hauptachsen meiner Arbeit. AI4Sec (AI for Security) und Agentensicherheit liegen an ihrer Schnittstelle.',
	),
	focusAreas: [
		{
			id: 'agent-systems',
			title: text('Agent Systems & Engineering', '智能体系统与工程构建', 'Agentensysteme & Engineering'),
			items: [
				text('Agent Harnesses', 'Agent Harnesses', 'Agent Harnesses'),
				text('Tool Use and Orchestration', '工具调用与多智能体编排', 'Werkzeugnutzung und Orchestrierung'),
				text('Context and Evaluation', '上下文工程与基准评测', 'Kontext und Evaluation'),
				text('Reliable Agent Workflows', '高可靠智能体工作流', 'Zuverlässige Agenten-Workflows'),
			],
		},
		{
			id: 'software-security',
			title: text('Software Security', '软件与系统安全', 'Softwaresicherheit'),
			items: [
				text('Vulnerability Discovery', '漏洞挖掘与挖掘方法学', 'Schwachstellenentdeckung'),
				text('Program Analysis', '静态与动态程序分析', 'Programmanalyse'),
				text('Exploitability Validation', '可利用性验证与 PoC 构建', 'Validierung der Ausnutzbarkeit'),
			],
		},
		{
			id: 'ai4sec',
			title: text('AI4Sec & Agent Security — The Intersection', 'AI4Sec 与智能体安全 —— 交叉领域', 'AI4Sec & Agentensicherheit — die Schnittstelle'),
			items: [
				text('Agent Security', '智能体本体安全与对抗攻防', 'Agentensicherheit'),
				text('AI-assisted Program Analysis', 'AI 驱动的程序语义分析', 'KI-gestützte Programmanalyse'),
				text('Automated Vulnerability Reasoning', '漏洞因果推理与形式化审计', 'Automatisierte Schwachstellenanalyse'),
				text('E2E Closed-loop Validation', '端到端闭环验证', 'E2E-Closed-Loop-Validierung'),
			],
		},
	],
	pathsTitle: text('Forking Paths', '分岔的小径', 'Abzweigende Pfade'),
	pathsIntro: text(
		'Forking paths of curiosity—from auxiliary crafts to written thoughts and the open snow.',
		'由好奇心引申出的分岔小径 —— 从极客旁门技艺、心智哲学沉思，直到浩瀚无垠的开阔雪野。',
		'Abzweigende Pfade der Neugier — von ergänzenden Fertigkeiten und geschriebenen Gedanken bis zum offenen Schnee.',
	),
	paths: [
		text('Penetration Testing', '实战攻防与渗透测试', 'Penetrationstests'),
		text('Algorithms & Data Structures', '算法设计与数据结构', 'Algorithmen & Datenstrukturen'),
		text('Thoughts on Philosophy and Mind', '心智哲学与认知模型', 'Gedanken über Philosophie und Geist'),
		text('Essays, Prose, and Creative Writing', '散文随笔与自由书写', 'Essays, Prosa und kreatives Schreiben'),
		text('Snowboarding & Fitness', '单板滑雪与健身塑形', 'Snowboarden & Fitness'),
	],
	galleryTitle: text('Gallery', '光影定格', 'Galerie'),
	galleryExplore: text('Explore Gallery', '步入画廊', 'Galerie ansehen'),
	galleryDescription: text('A curated collection of personal moments.', '克制留存的个人瞬间与空间记忆。', 'Eine kuratierte Sammlung persönlicher Momente.'),
	hallTitle: text('Hall of Fame', '里程碑与印记', 'Hall of Fame'),
	hallExplore: text('View Hall', '查阅履迹', 'Hall ansehen'),
	hallDescription: text('Selected milestones worth keeping on the wall.', '值得在此立石留存的节点、漏洞致谢与认可。', 'Ausgewählte Meilensteine, die einen Platz an der Wand verdienen.'),
	elsewhere: text('Elsewhere', '别处行迹', 'Anderswo'),
};

export const collectionContent = {
	gallery: {
		eyebrow: text('Curated moments', '凝眸瞬间', 'Kuratierte Momente'),
		title: text('Gallery', '光影定格', 'Galerie'),
		description: text('A modest, curated collection of personal moments and places.', '一组克制凝固的时间切片、旅痕与空间记忆。', 'Eine kleine, kuratierte Sammlung persönlicher Momente und Orte.'),
		empty: text('The gallery is waiting for its first selected image.', '展厅正静待第一缕光影入选。', 'Die Galerie wartet auf ihr erstes ausgewähltes Bild.'),
	},
	hall: {
		eyebrow: text('Milestones & recognition', '履迹与认可', 'Meilensteine & Anerkennung'),
		title: text('Hall of Fame', '里程碑与印记', 'Hall of Fame'),
		description: text('Selected milestones and recognitions worth keeping on the wall.', '值得在此立石铭记的关键节点、社区致谢与认可。', 'Ausgewählte Meilensteine und Anerkennungen, die einen Platz an der Wand verdienen.'),
		empty: text('No milestones have been published here yet.', '尚无公开的里程碑记录。', 'Hier wurden noch keine Meilensteine veröffentlicht.'),
	},
};
