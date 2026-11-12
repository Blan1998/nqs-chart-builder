// Mô tả ngắn từng loại, dùng để AI gợi ý loại phù hợp với dữ liệu
export const CHART_GUIDE = {
  pie: 'Tỷ lệ các phần trong một tổng (cơ cấu, thị phần). Phù hợp khi có ít phần (dưới 7).',
  bar: 'So sánh giá trị giữa các danh mục hoặc các mốc thời gian, một chuỗi dữ liệu.',
  line: 'Xu hướng theo thời gian của một hoặc nhiều chuỗi, nhìn tăng giảm qua các mốc.',
  groupedBar: 'So sánh nhiều chuỗi giữa các danh mục, mỗi danh mục có các cột cạnh nhau.',
  combo: 'Kết hợp cột và đường, dùng khi hai chuỗi khác đơn vị hoặc khác quy mô.',
  stackedBar: 'Cơ cấu của tổng theo từng mốc, các phần cộng lại thành tổng, có thể chuyển 100%.',
  rankBar: 'Xếp hạng các danh mục theo một giá trị, từ lớn đến nhỏ.',
  barRace: 'Đua thanh: thứ hạng các quốc gia/đối tượng thay đổi theo từng năm, có cờ và khu vực. Dùng khi dữ liệu có nhiều mốc thời gian và nhiều đối tượng.',
  lineRank: 'Đường xếp hạng theo năm: so sánh giá trị hoặc thứ hạng của nhiều đối tượng qua các mốc thời gian.',
};
