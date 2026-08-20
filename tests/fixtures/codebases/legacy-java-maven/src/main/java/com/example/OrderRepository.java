package com.example;

import javax.persistence.Entity;
import javax.persistence.Id;

@Entity
public class OrderRepository implements java.io.Serializable {

    @Id
    private Long id;
}
