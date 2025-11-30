import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';  

@Component({
  selector: 'app-root',
  standalone: true,  
  imports: [RouterOutlet, RouterLink], 
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  /*  defining a class property `title` that is both `protected` and `readonly`. */
  protected readonly title = signal('angul-it');  
}
