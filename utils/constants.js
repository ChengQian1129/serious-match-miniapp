const GENDERS = [
  { label: '男生', value: 'male' },
  { label: '女生', value: 'female' },
  { label: '其他或暂不说明', value: 'undisclosed' }
]

const TARGET_GENDERS = [
  { label: '男生', value: 'male' },
  { label: '女生', value: 'female' },
  { label: '都可以', value: 'all' },
  { label: '暂不说明', value: 'undisclosed' }
]

const PREFERENCE_PRIORITIES = [
  { label: '必须满足', value: 'must' },
  { label: '很重要', value: 'important' },
  { label: '可以商量', value: 'discuss' },
  { label: '不在意', value: 'not_important' }
]

const DISTRICTS = [
  { label: '高新区', value: 'high_tech_zone' },
  { label: '甘井子区', value: 'ganjingzi' },
  { label: '沙河口区', value: 'shahekou' },
  { label: '西岗区', value: 'xigang' },
  { label: '中山区', value: 'zhongshan' },
  { label: '金普新区', value: 'jinpu' },
  { label: '旅顺口区', value: 'lvshunkou' },
  { label: '大连其他区域', value: 'other_dalian' }
]

const GOALS = [
  { label: '认真恋爱，以长期关系为目标', value: 'long_term' },
  { label: '明确考虑结婚', value: 'marriage' },
  { label: '先自然认识，再看是否合适', value: 'natural' },
  { label: '愿意认真了解，但没有明确时间表', value: 'open' },
  { label: '目前还没有完全想清楚', value: 'unsure' }
]

const SETTLEMENT_PLANS = [
  { label: '倾向长期留在大连', value: 'stay_dalian' },
  { label: '未来可能去其他城市', value: 'may_leave' },
  { label: '可以根据伴侣和机会共同决定', value: 'decide_together' },
  { label: '目前不确定', value: 'unsure' }
]

const CHILD_PLANS = [
  { label: '希望有孩子', value: 'want' },
  { label: '可以商量', value: 'negotiable' },
  { label: '目前不确定', value: 'unsure' },
  { label: '不计划要孩子', value: 'no' },
  { label: '暂不填写', value: 'skip' }
]

const RELATIONSHIP_AVAILABILITY = [
  { label: '目前单身，也愿意认真了解关系', value: 'single_ready' },
  { label: '目前单身，但暂时不适合进入关系', value: 'single_not_ready' },
  { label: '情况较复杂，暂不说明', value: 'undisclosed' }
]

const MARITAL_HISTORY = [
  { label: '未婚', value: 'never_married' },
  { label: '离异', value: 'divorced' },
  { label: '丧偶', value: 'widowed' },
  { label: '暂不说明', value: 'undisclosed' }
]

const CHILDREN_STATUS = [
  { label: '目前没有孩子', value: 'none' },
  { label: '有孩子，目前不共同生活', value: 'not_living_together' },
  { label: '有孩子，目前共同生活', value: 'living_together' },
  { label: '暂不说明', value: 'undisclosed' }
]

const DISTANCE_ACCEPTANCE = [
  { label: '只考虑在大连生活的人', value: 'dalian_only' },
  { label: '可以接受周边城市', value: 'nearby' },
  { label: '可短期异地，需有明确计划', value: 'temporary_long_distance' },
  { label: '可以再具体商量', value: 'open' }
]

const SMOKING_STATUS = [
  { label: '不吸烟', value: 'never' },
  { label: '偶尔吸烟', value: 'occasionally' },
  { label: '经常吸烟', value: 'regularly' },
  { label: '正在戒烟', value: 'quitting' },
  { label: '暂不说明', value: 'undisclosed' }
]

const SMOKING_ACCEPTANCE = [
  { label: '不能接受对方吸烟', value: 'never' },
  { label: '可以接受偶尔吸烟', value: 'occasionally' },
  { label: '可以接受', value: 'any' },
  { label: '可以再具体商量', value: 'open' }
]

const MEETING_TIMES = [
  { label: '工作日白天', value: 'weekday_daytime' },
  { label: '工作日晚上', value: 'weekday_evening' },
  { label: '周末白天', value: 'weekend_daytime' },
  { label: '周末晚上', value: 'weekend_evening' },
  { label: '时间比较灵活', value: 'flexible' }
]
const COMMUTE_TOLERANCE = [
  { label: '尽量同一区域', value: 'same_district' },
  { label: '单程约 30 分钟内', value: 'within_30m' },
  { label: '单程约 60 分钟内', value: 'within_60m' },
  { label: '距离可以具体商量', value: 'flexible' }
]
const SCHEDULE_PATTERNS = [
  { label: '固定白班，周末相对稳定', value: 'regular' },
  { label: '时间弹性较大', value: 'flexible' },
  { label: '轮班或倒班', value: 'shift' },
  { label: '经常出差', value: 'frequent_travel' },
  { label: '作息经常变化', value: 'irregular' }
]
const MARRIAGE_TIMELINES = [
  { label: '合适的话一两年内', value: 'one_two_years' },
  { label: '希望先相处，不设固定期限', value: 'no_fixed_timeline' },
  { label: '目前不急着考虑结婚', value: 'not_soon' },
  { label: '还不确定', value: 'unsure' }
]
const PARENT_COHABITATION = [
  { label: '倾向不与父母长期同住', value: 'separate' },
  { label: '特殊阶段可以短期同住', value: 'temporary' },
  { label: '未来可能需要共同生活', value: 'possible' },
  { label: '希望婚后与父母同住', value: 'expected' },
  { label: '可以根据情况商量', value: 'discuss' }
]
const FINANCE_STYLES = [
  { label: '各自管理，公共支出共同承担', value: 'mostly_separate' },
  { label: '共同预算，也保留个人账户', value: 'shared_budget' },
  { label: '主要收入和支出共同管理', value: 'mostly_shared' },
  { label: '没有固定设想，可以商量', value: 'discuss' }
]
const HOUSEWORK_STYLES = [
  { label: '尽量平均分担', value: 'equal' },
  { label: '按各自擅长的事情分工', value: 'by_strength' },
  { label: '谁当时更有时间谁多承担', value: 'by_time' },
  { label: '可以结合实际商量', value: 'discuss' }
]
const PET_ACCEPTANCE = [
  { label: '自己有宠物或希望养宠物', value: 'have_or_want' },
  { label: '可以接受对方养宠物', value: 'accept' },
  { label: '需要看具体情况', value: 'depends' },
  { label: '不能接受共同养宠物', value: 'not_accept' }
]
const ALCOHOL_ACCEPTANCE = [
  { label: '希望双方基本不饮酒', value: 'none' },
  { label: '可以接受社交场合少量饮酒', value: 'social' },
  { label: '可以接受适量饮酒', value: 'moderate' },
  { label: '可以结合具体习惯商量', value: 'discuss' }
]
const SOCIAL_RHYTHMS = [
  { label: '更喜欢安静、居家的生活', value: 'home_focused' },
  { label: '独处和社交比较平衡', value: 'balanced' },
  { label: '朋友聚会和外出活动较多', value: 'social_active' },
  { label: '没有固定节奏', value: 'flexible' }
]

const WORK_STATUSES = [
  { label: '全职工作', value: 'full_time' },
  { label: '自由职业', value: 'freelance' },
  { label: '创业或个体经营', value: 'business' },
  { label: '在读', value: 'student' },
  { label: '暂未工作', value: 'not_working' },
  { label: '其他', value: 'other' },
  { label: '暂不填写', value: 'skip' }
]

const INDUSTRIES = [
  { label: '互联网与软件', value: 'internet' },
  { label: '通信与电子科技', value: 'telecom' },
  { label: '教育与科研', value: 'education' },
  { label: '医疗与健康', value: 'healthcare' },
  { label: '金融与保险', value: 'finance' },
  { label: '制造与工程', value: 'manufacturing' },
  { label: '文化与创意', value: 'creative' },
  { label: '商业与服务业', value: 'business_service' },
  { label: '公共服务', value: 'public_service' },
  { label: '其他行业', value: 'other' }
]

module.exports = {
  GENDERS,
  TARGET_GENDERS,
  PREFERENCE_PRIORITIES,
  DISTRICTS,
  GOALS,
  SETTLEMENT_PLANS,
  CHILD_PLANS,
  RELATIONSHIP_AVAILABILITY,
  MARITAL_HISTORY,
  CHILDREN_STATUS,
  DISTANCE_ACCEPTANCE,
  SMOKING_STATUS,
  SMOKING_ACCEPTANCE,
  MEETING_TIMES,
  COMMUTE_TOLERANCE,
  SCHEDULE_PATTERNS,
  MARRIAGE_TIMELINES,
  PARENT_COHABITATION,
  FINANCE_STYLES,
  HOUSEWORK_STYLES,
  PET_ACCEPTANCE,
  ALCOHOL_ACCEPTANCE,
  SOCIAL_RHYTHMS,
  WORK_STATUSES,
  INDUSTRIES
}
