"""Hand-authored questions for the retrieval golden set.

Written by reading each sampled notice, phrased the way a student would type into
the chatbot -- never a copy of the title, or keyword matching would win by
construction and the scores would say nothing about the retriever.

Some near-duplicate notices are kept on purpose (weekly recruiting posts, the same
취업계/졸업논문 notice from different departments and semesters). Those are the cases
the department filter and the recency rules are supposed to fix.

Keyed by the notice URL, not by position in candidates.json. Position keys broke
once already: masking PII shortened some bodies below the length threshold, the
sample shifted, and 29 of 44 questions silently ended up paired with the wrong
notice. The URL is stable no matter how the sample is drawn.
"""

QUESTIONS = {
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=759211&article.offset=0&articleLimit=1000&srUpperNoticeYn=on":
        "천안캠에서 하는 독서토론 소모임 신청하려면 어떻게 해?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=763628&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "2026년 3월 둘째 주에 올라온 채용 인턴 정보 알려줘",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=754249&article.offset=1000&articleLimit=1000&srUpperNoticeYn=on":
        "군산에 사는데 학자금 대출 이자 지원해주는 제도 있어?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=756925&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "관악구에서 하는 AI 빅데이터 청년 창업 교육 모집한대?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=761070&article.offset=0&articleLimit=1000&srUpperNoticeYn=on":
        "인문사회융합인재양성사업단 공모전 언제 열려?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=761343&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "천안 4개 대학 진입로 사인 디자인 공모전 어떻게 참여해?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=754558&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "2025학년도 1학기 교내장학금 신청 기간이 언제야?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=755964&article.offset=1000&articleLimit=1000&srUpperNoticeYn=on":
        "새활용이나 ESG 분야 스타트업 입주 모집 언제까지 신청이야?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=753222&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "서대문구 자원봉사센터에서 하는 환경 물품 제작 봉사 어떻게 신청해?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=759823&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "졸업하고 농업 쪽으로 갈 생각인데 받을 수 있는 장학금 있어?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=753322&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "대학원생인데 두레조교 지원 자격이 어떻게 돼?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=754351&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "은평구에 살면 받을 수 있는 장학금 접수 기간 알려줘",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=756134&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "국가장학금 1유형 지급됐는지 어디서 확인해?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=758917&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "2025년 9월 첫째 주 주간 채용 정보 알려줘",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=754156&article.offset=1000&articleLimit=1000&srUpperNoticeYn=on":
        "서울시 넥스트로컬 청년 창업 지원사업 모집하나?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=760984&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "홍제천 쪽에서 하는 플로깅 봉사 언제 하고 어떻게 신청해?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=755206&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "독립유공자 후손이면 받을 수 있는 장학금 신청 자격이 뭐야?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=760359&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "시각장애인 댄스교실 활동 지원 봉사 언제까지 모집해?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=760661&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "2025년 2학기 프레젠테이션 대회 특강 언제 어디서 해?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=754067&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "2025학년도 1학기 상명튜터링 신청 방법이랑 마감일 알려줘",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=763623&article.offset=0&articleLimit=12000&srUpperNoticeYn=on":
        "서울식물원에서 전시 운영 보조하는 봉사활동 언제야?",
    "https://www.smu.ac.kr/kor/life/notice.do?mode=view&articleNo=765451&article.offset=0&articleLimit=1000&srUpperNoticeYn=on":
        "이공계 국가우수장학금 재학중우수자 유형 지원 자격 알려줘",
    "https://www.smu.ac.kr/cs/community/notice.do?mode=view&articleNo=756888&article.offset=0&articleLimit=1000":
        "컴퓨터과학전공인데 전자출결 앱 새로 바뀐다며? 뭐 설치해야 해?",
    "https://www.smu.ac.kr/smubiz/community/notice.do?mode=view&articleNo=762350&article.offset=0&articleLimit=1000":
        "경영학부 계당장학재단 장학생 신청 기한이 언제까지야?",
    "https://www.smu.ac.kr/smfamily/community/notice.do?mode=view&articleNo=759337&article.offset=0&articleLimit=1000":
        "아동청소년상담연계전공 졸업시험 언제 어디서 봐?",
    "https://www.smu.ac.kr/libinfo/community/notice.do?mode=view&articleNo=764112&article.offset=0&articleLimit=1000":
        "문헌정보학전공 2026학년도 1학기 졸업 신청 어떻게 해?",
    "https://www.smu.ac.kr/history/community/notice.do?mode=view&articleNo=756746&article.offset=0&articleLimit=1000":
        "여름방학에 고고학 발굴 현장 알바 모집한다던데 누가 지원할 수 있어?",
    "https://www.smu.ac.kr/cs/community/notice.do?mode=view&articleNo=764220&article.offset=0&articleLimit=1000":
        "컴퓨터과학전공 학부연구실 좌석 신청하려면 뭘 내야 해?",
    "https://www.smu.ac.kr/newmajoritb/board/notice.do?mode=view&articleNo=755092&article.offset=0&articleLimit=1000":
        "KEC과학교육재단 산학장학생 성적 기준이 어떻게 돼?",
    "https://www.smu.ac.kr/cm/community/notice.do?mode=view&articleNo=763678&article.offset=0&articleLimit=1000":
        "융합경영학과 2026학년도 1학기 졸업논문 계획서 언제까지 내야 해?",
    "https://www.smu.ac.kr/aiot/community/notice.do?mode=view&articleNo=759596&article.offset=0&articleLimit=1000":
        "폐지된 과목 재수강하려면 신청서 따로 내야 한다던데 언제까지야?",
    "https://www.smu.ac.kr/mathedu/community/notice.do?mode=view&articleNo=756067&article.offset=0&articleLimit=1000":
        "수학교육과 면학B 장학금 소득분위 기준이 어떻게 돼?",
    "https://www.smu.ac.kr/koredu/community/notice.do?mode=view&articleNo=762865&article.offset=0&articleLimit=1000":
        "국어교육과 취업계 내면 출석 처리가 어떻게 돼?",
    "https://www.smu.ac.kr/history/community/notice.do?mode=view&articleNo=756747&article.offset=0&articleLimit=1000":
        "상록장학생 추천 인원이랑 성적 기준 알려줘",
    "https://www.smu.ac.kr/smfamily/community/notice.do?mode=view&articleNo=758048&article.offset=0&articleLimit=1000":
        "가족복지학과 면학장학금 신청서 어디로 보내야 해?",
    "https://www.smu.ac.kr/cm/community/notice.do?mode=view&articleNo=759220&article.offset=0&articleLimit=1000":
        "융합경영학과 2025학년도 2학기 졸업논문 일정 알려줘",
    "https://www.smu.ac.kr/cs/community/notice.do?mode=view&articleNo=757762&article.offset=0&articleLimit=1000":
        "2025학년도 2학기 휴학 신청 기간이랑 방법 알려줘",
    "https://www.smu.ac.kr/history/community/notice.do?mode=view&articleNo=762880&article.offset=0&articleLimit=1000":
        "역사콘텐츠전공 학과사무실 근로장학생 근로 시간이랑 장학금 얼마야?",
    "https://www.smu.ac.kr/engedu/community/notice.do?mode=view&articleNo=758034&article.offset=0&articleLimit=1000":
        "영어교육과 취업계 제도 적용 대상이 누구야?",
    "https://www.smu.ac.kr/newmajoritb/board/notice.do?mode=view&articleNo=759763&article.offset=0&articleLimit=1000":
        "피어오름 2025 프로그램이 뭐고 어떻게 참여해?",
    "https://www.smu.ac.kr/space/community/notice.do?mode=view&articleNo=759161&article.offset=0&articleLimit=1000":
        "공간정보빅데이터연계전공 포트폴리오졸업인증제 일정 알려줘",
    "https://www.smu.ac.kr/smulad/community/notice.do?mode=view&articleNo=757224&article.offset=0&articleLimit=1000":
        "생활예술전공인데 헤이영캠퍼스 출결 시스템 언제부터 쓰는 거야?",
    "https://www.smu.ac.kr/dance/undergraduate/undergraduate_notice.do?mode=view&articleNo=765509&article.offset=0&articleLimit=1000":
        "무용 연습실 야간이랑 철야로 쓰려면 어떻게 신청해?",
    "https://www.smu.ac.kr/fbs/community/notice.do?mode=view&articleNo=762732&article.offset=0&articleLimit=1000":
        "핀테크 전공 수강신청 증원 요청은 어떻게 하는 거야?",
}
