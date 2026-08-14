// 학부는 children으로 소속 전공을 나열하고, 학과/단일 링크 학부는 url을 직접 갖습니다.
export const mockCatalog = {
  tags: ["일반", "진로·취업", "행사", "등록·장학", "비교과", "학생생활", "사회봉사", "글로벌"],
  departments: [
    {
      name: "인문사회과학대학",
      majors: [
        {
          name: "인문콘텐츠학부",
          children: [
            { name: "역사콘텐츠전공", url: "https://history.smu.ac.kr/history/index.do" },
            { name: "지적재산권전공", url: "https://cr.smu.ac.kr/cc/index.do" },
            { name: "문헌정보학전공", url: "https://libinfo.smu.ac.kr/libinfo/index.do" },
            { name: "한일문화콘텐츠전공", url: "https://kjc.smu.ac.kr/kjc/index.do" },
          ],
        },
        { name: "공간환경학부", url: "https://space.smu.ac.kr/space/index.do" },
        { name: "행정학부", url: "https://public.smu.ac.kr/public/index.do" },
        { name: "가족복지학과", url: "https://smfamily.smu.ac.kr/smfamily/index.do" },
        { name: "국가안보학과", url: "https://ns.smu.ac.kr/sdms/index.do" },
      ],
    },
    {
      name: "사범대학",
      majors: [
        { name: "국어교육과", url: "https://koredu.smu.ac.kr/koredu/index.do" },
        { name: "영어교육과", url: "https://engedu.smu.ac.kr/engedu/index.do" },
        { name: "교육학과", url: "https://learning.smu.ac.kr/peda/index.do" },
        { name: "수학교육과", url: "https://mathed.smu.ac.kr/mathedu/index.do" },
      ],
    },
    {
      name: "경영경제대학",
      majors: [
        { name: "경제금융학부", url: "https://econo.smu.ac.kr/economic/index.do" },
        { name: "경영학부", url: "https://smubiz.smu.ac.kr/smubiz/index.do" },
        { name: "글로벌경영학과", url: "https://gbiz.smu.ac.kr/newmajoritb/index.do" },
        { name: "융합경영학과", url: "https://imgmt.smu.ac.kr/cm/index.do" },
      ],
    },
    {
      name: "융합공과대학",
      majors: [
        {
          name: "지능·데이터융합학부",
          children: [
            { name: "휴먼지능정보공학전공", url: "https://hi.smu.ac.kr/hi/index.do" },
            { name: "핀테크전공 · 빅데이터융합전공 · 스마트생산전공", url: "https://fbs.smu.ac.kr/fbs/index.do" },
          ],
        },
        {
          name: "SW융합학부",
          children: [
            { name: "컴퓨터과학전공", url: "https://cs.smu.ac.kr/cs/index.do" },
            { name: "전기공학전공", url: "https://electric.smu.ac.kr/electric/index.do" },
            { name: "지능IOT융합전공", url: "https://aiot.smu.ac.kr/aiot/index.do" },
            { name: "게임전공", url: "https://game.smu.ac.kr/game01/index.do" },
            { name: "애니메이션전공", url: "https://animation.smu.ac.kr/animation/index.do" },
          ],
        },
        {
          name: "생명화학공학부",
          children: [
            { name: "생명공학전공", url: "https://biotechnology.smu.ac.kr/biotechnology/index.do" },
            { name: "화학에너지공학전공", url: "https://energy.smu.ac.kr/cee/index.do" },
            { name: "화공신소재전공", url: "https://ichem.smu.ac.kr/ichemistry/index.do" },
            { name: "식품영양학전공", url: "https://food.smu.ac.kr/foodnutrition/index.do" },
          ],
        },
      ],
    },
    {
      name: "문화예술대학",
      majors: [
        { name: "의류학과", url: "https://fashionindustry.smu.ac.kr/clothing2/index.do" },
        {
          name: "스포츠무용학부",
          children: [
            { name: "스포츠건강관리전공", url: "https://sports.smu.ac.kr/smpe/index.do" },
            { name: "무용예술전공", url: "https://dance.smu.ac.kr/dance/index.do" },
          ],
        },
        {
          name: "미술학부",
          children: [
            { name: "조형예술전공", url: "https://finearts.smu.ac.kr/finearts/index.do" },
            { name: "생활예술전공", url: "https://smulad.smu.ac.kr/smulad/index.do" },
          ],
        },
        { name: "음악학부", url: "https://music.smu.ac.kr/music/index.do" },
      ],
    },
  ],
};
