import { Controller, Get, UseGuards } from "@nestjs/common";

export class AuthGuard {}

@Controller("api/users")
export class UsersController {
  @UseGuards(AuthGuard)
  @Get(":id")
  async getProfile() {
    return { id: 1 };
  }
}
