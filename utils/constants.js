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
  DISTRICTS,
  GOALS,
  SETTLEMENT_PLANS,
  CHILD_PLANS,
  WORK_STATUSES,
  INDUSTRIES
}
