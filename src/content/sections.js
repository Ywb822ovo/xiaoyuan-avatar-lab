export const sections = [
  {
    id: "about",
    navLabel: "ABOUT",
    kicker: "ABOUT",
    title: "个人介绍",
    lead: "这里将根据你的真实经历整理个人简介，目前先保留内容结构。",
    cards: [
      {
        label: "个人定位",
        value: "等待从简历资料中提取",
      },
      {
        label: "关注方向",
        value: "等待你确认后补充",
      },
    ],
  },
  {
    id: "resume",
    navLabel: "RÉSUMÉ",
    kicker: "RÉSUMÉ",
    title: "个人简历",
    lead: "学历、经历与技能将在下一阶段从你提供的简历中整理，不在这里虚构。",
    cards: [
      {
        label: "经历时间线",
        value: "真实资料待整理",
      },
      {
        label: "技能与能力",
        value: "真实资料待整理",
      },
    ],
  },
  {
    id: "project-a",
    navLabel: "PROJECT A",
    kicker: "PROJECT / A",
    title: "项目 A",
    lead: "这是首个项目展示位，后续替换为你的真实项目名称、说明和成果。",
    cards: [
      {
        label: "项目角色",
        value: "示例内容",
      },
      {
        label: "项目成果",
        value: "示例内容",
      },
    ],
  },
  {
    id: "project-b",
    navLabel: "PROJECT B",
    kicker: "PROJECT / B",
    title: "项目 B",
    lead: "这是第二个项目展示位，可承载作品图、过程说明和外部链接。",
    cards: [
      {
        label: "项目类型",
        value: "示例内容",
      },
      {
        label: "使用工具",
        value: "示例内容",
      },
    ],
  },
  {
    id: "project-c",
    navLabel: "PROJECT C",
    kicker: "PROJECT / C",
    title: "项目 C",
    lead: "这是第三个项目展示位，当前只验证空间结构和章节切换。",
    cards: [
      {
        label: "项目状态",
        value: "示例内容",
      },
      {
        label: "查看详情",
        value: "后续开放",
      },
    ],
  },
  {
    id: "contact",
    navLabel: "CONTACT",
    kicker: "CONTACT",
    title: "联系方式",
    lead: "邮箱、社交平台和其他联系方式需要你确认后再公开。",
    cards: [
      {
        label: "电子邮箱",
        value: "待补充",
      },
      {
        label: "社交平台",
        value: "待补充",
      },
    ],
  },
];

export function getSectionIndex(sectionId) {
  return sections.findIndex((section) => section.id === sectionId);
}
