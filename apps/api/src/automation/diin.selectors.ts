export const diinSelectors = {
  login: {
    username: ["#Email", "input[name='Email']", "input[name='Username']", "input[type='text']"],
    password: ["#Password", "input[name='Password']", "input[type='password']"],
    submit: ["button[type='submit']", "input[type='submit']"]
  },
  links: {
    issuedCars: "/DiinInsurance",
    issuedCarsCreate: "/DiinInsurance/Create",
    insuranceMaster: "/InsuranceMaster",
    insuranceMasterCreate: "/InsuranceMaster/Create"
  },
  buttons: {
    save: /Lưu/i,
    calculate: /Tính phí/i,
    issue: /Phát hành/i,
    create: /Tạo mới/i,
    certificate: /GCN/i
  }
} as const;
