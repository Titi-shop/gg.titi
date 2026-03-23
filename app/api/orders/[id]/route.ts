const { rows } = await query(
  `
  select
    o.id,
    o.total,
    o.status,
    o.created_at,

    json_agg(
      json_build_object(
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'thumbnail', oi.thumbnail,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'status', oi.status
      )
      order by oi.created_at asc
    ) as order_items

  from orders o
  join order_items oi on oi.order_id = o.id

  where o.id = $1
  and o.buyer_id = $2

  group by o.id
  `,
  [params.id, user.pi_uid]
);
