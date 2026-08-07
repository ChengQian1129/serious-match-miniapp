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
  WORK_STATUSES,
  INDUSTRIES
}
