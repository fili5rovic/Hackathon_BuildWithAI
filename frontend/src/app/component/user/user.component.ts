import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserService } from 'src/app/java-services/user/user.service';
import { UserJava } from 'src/app/models/user-java';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css']
})
export class UserComponent {

  constructor(private userServiceJava: UserService) {}
  user: UserJava[] = [];

  async ngOnInit() {
    try {
      this.user = await firstValueFrom(
        this.userServiceJava.findAllUsers()
      );
      console.log(this.user);
    } catch(error: any) {
      console.error("Greska ", error);
    }
  }

}
